"""Guardo o caso só na memória e só junto mensagens quando há continuidade."""
import re
from .engine import Engine
from .contracts import Evaluation


class Session:
    def __init__(self, engine: Engine):
        self.engine = engine
        self.reset()

    def reset(self) -> None:
        # Não reutilizo interpretações de uma OS depois de Novo caso.
        for extractor in self.engine.extractors.values():
            extractor.cache.clear()
        self.query = ''
        self.service_id = ''
        self.last: Evaluation | None = None
        self.messages: list[tuple[str, str | None]] = []

    def ask(self, query: str, service_id: str) -> Evaluation:
        normal = self.engine.text.normalize(query)
        new_case = bool(re.match(r'^(?:outro caso|nova os|novo caso|outra os)\b', normal))
        follow_up = bool(re.match(r'^(?:mas|e |tambem|corrigindo|na verdade|complementando|nesse caso)', normal))
        answers_pending = bool(self.last and self.last.pendingInformation)
        continued = bool(self.query and service_id == self.service_id and not new_case and (follow_up or answers_pending))
        combined = self.query + '. ' + query if continued else query
        if len(combined) > 8000:
            result = self.engine.evaluate(combined, service_id)
            return result
        if not continued:
            # Vale também para "novo caso" escrito no chat e troca de serviço,
            # não só para o botão. Nenhuma interpretação passa para outra OS.
            for extractor in self.engine.extractors.values():
                extractor.cache.clear()
        hint = (self.last.pendingContext or {}).get('scope') if continued and self.last else None
        if continued and not hint and self.last and re.match(r'^(?:corrigindo|na verdade)', normal):
            hint = self.last.activeScope
        messages = self.messages + [(query, hint)] if continued else [(query, None)]
        result = self.engine.evaluate(combined, service_id, messages=messages)
        result.contextApplied = continued
        if not result.errorCode:
            self.query, self.service_id, self.last = combined, service_id, result
            self.messages = messages
        return result
