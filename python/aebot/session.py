"""Guardo o caso só na memória e só junto mensagens quando há continuidade."""
import re
from dataclasses import dataclass
from .engine import Engine
from .contracts import Evaluation


@dataclass
class Scenario:
    query: str
    messages: list[tuple[str, str | None]]
    service_id: str
    ignored_sources: set[tuple[int, str, str]]
    last: Evaluation


@dataclass(frozen=True)
class PendingConsultation:
    service_id: str
    last: Evaluation


class Session:
    def __init__(self, engine: Engine):
        self.engine = engine
        self.reset()

    def reset(self) -> None:
        # Não reutilizo interpretações de uma OS depois de Novo caso.
        self._clear_cache()
        self.query = ''
        self.service_id = ''
        self.last: Evaluation | None = None
        self.case_last: Evaluation | None = None
        self.scenario: Scenario | None = None
        self.consultation: PendingConsultation | None = None
        self.messages: list[tuple[str, str | None]] = []
        self.ignored_sources: set[tuple[int, str, str]] = set()

    @property
    def pending(self) -> Evaluation | None:
        """A consulta mais recente não apaga a devolutiva do caso/simulação."""
        previous = self.scenario.last if self.scenario else self.case_last
        return previous if previous and previous.pendingInformation else None

    def _clear_cache(self) -> None:
        for extractor in self.engine.extractors.values():
            extractor.cache.clear()
        self.engine.text.clear_cache()

    def _scenario_reply(self, query: str, intent: str, follow_up: bool) -> bool:
        """Confiro o dado pendente; uma pergunta nova não é confirmação."""
        if not self.scenario or intent != 'report':
            return False
        previous = self.scenario.last
        if not previous.pendingInformation:
            return False
        normal = self.engine.text.normalize(query)
        if follow_up or re.match(r'^nao sei\b', normal):
            return True
        dimension = (previous.pendingContext or {}).get('dimension')
        contexts = self.engine.store.data.get('interpretation', {}).get('contexts', [])
        definition = next((item for item in contexts if item['id'] == dimension), None)
        # A resposta pode incluir outra falha; não uso limite de palavras.
        return bool(definition and self.engine.text.found(query,
            [term for value in definition['values'] for term in value['expressions']]))

    def ask(self, query: str, service_id: str) -> Evaluation:
        invalid = self.engine.validate_request(query, service_id)
        if invalid:
            return invalid
        active_service = self.scenario.service_id if self.scenario else self.service_id or (self.consultation.service_id if self.consultation else '')
        if active_service and active_service != service_id and service_id in self.engine.store.services:
            self.reset()
        normal = self.engine.text.normalize(query)
        new_case = bool(re.match(r'^(?:outro caso|nova os|novo caso|outra os)\b', normal))
        if new_case:
            self.reset()
        current_intent = self.engine.text.intent(query)
        clarifies_query = bool(self.consultation and self.consultation.service_id == service_id
            and self.last is self.consultation.last and re.match(
                r'^(?:quis dizer|quero dizer|estou perguntando|a duvida e|pergunto sobre)\b', normal))
        if (current_intent == 'question' and self.engine.text.general_question(query)) or clarifies_query:
            # Consulto a mensagem atual, não reinterpreto a OS inteira com
            # intenção de pergunta. O caso e a hipótese pendente ficam intactos.
            if not self.query and not self.scenario and not clarifies_query:
                self._clear_cache()
            result = self.engine.evaluate(query, service_id, intent='question', consultation=clarifies_query)
            if not result.errorCode:
                self.last = result
                self.consultation = PendingConsultation(service_id, result) if result.pendingInformation else None
            return result
        resume_case = bool(re.match(r'^(?:voltando|retomando) (?:ao|a|para o|para a|o) (?:caso real|os real|os atual)\b', normal))
        follow_up = bool(re.match(r'^(?:mas|e|tambem|corrigindo|na verdade|complementando|nesse caso|quis dizer|quero dizer)\b', normal))
        scenario_answer = bool(self.scenario and self.scenario.service_id == service_id
            and not new_case and not resume_case and self._scenario_reply(query, current_intent, follow_up))
        hypothetical = current_intent == 'hypothesis' or scenario_answer
        previous = self.scenario.last if scenario_answer else self.case_last
        previous_query, previous_messages = (self.scenario.query, self.scenario.messages) if scenario_answer else (self.query, self.messages)
        answers_pending = bool(previous and previous.pendingInformation)
        continued = bool(previous_query and (scenario_answer or service_id == self.service_id)
            and not new_case and (follow_up or answers_pending or hypothetical or resume_case))
        combined = previous_query + '. ' + query if continued else query
        if len(combined) > 8000:
            result = self.engine.evaluate(combined, service_id)
            return result
        if not continued:
            # Vale também para "novo caso" escrito no chat e troca de serviço,
            # não só para o botão. Nenhuma interpretação passa para outra OS.
            self._clear_cache()
        ignored = set(self.scenario.ignored_sources if scenario_answer else self.ignored_sources) if continued else set()
        clarification = previous.pendingClarification if continued and previous else None
        correcting = bool(re.match(r'^(?:quis dizer|quero dizer|corrigindo|na verdade|estou falando|e sobre)\b', normal))
        if clarification and correcting:
            # Retiro somente o trecho que motivou a pergunta. As outras
            # evidências e condições continuam na análise do mesmo caso.
            ignored.add((clarification['messageIndex'], clarification['scope'], clarification['sourceQuote']))
        hint = (previous.pendingContext or {}).get('scope') if continued and previous else None
        if clarification and correcting:
            hint = clarification['scope']
        if continued and not hint and previous and re.match(r'^(?:corrigindo|na verdade)', normal):
            hint = previous.activeScope
        messages = previous_messages + [(query, hint)] if continued else [(query, None)]
        result = self.engine.evaluate(combined, service_id, messages=messages,
            intent='hypothesis' if hypothetical else current_intent, ignored_sources=ignored)
        result.contextApplied = continued
        if not result.errorCode:
            self.last = result
            self.consultation = None
            if hypothetical:
                # Uma simulação pode pedir equipe/frente, mas seus fatos não
                # entram na OS real. Terminada a dúvida, retomo o caso anterior.
                self.scenario = Scenario(combined, messages, service_id, ignored, result) if result.pendingInformation else None
            elif result.intent == 'question' and not result.pendingContext and not result.pendingClarification:
                # Consultar uma regra também não cria uma ocorrência no caso.
                self.scenario = None
            else:
                self.query, self.service_id, self.case_last = combined, service_id, result
                self.messages, self.scenario = messages, None
                self.ignored_sources = ignored
        return result
