"""Guardo o caso só na memória e só junto mensagens quando há continuidade."""
import re
from .engine import Engine
from .contracts import Evaluation


class Session:
    def __init__(self, engine: Engine):
        self.engine = engine
        self.reset()

    def reset(self) -> None:
        self.query = ''
        self.service_id = ''
        self.last: Evaluation | None = None

    def ask(self, query: str, service_id: str) -> Evaluation:
        normal = self.engine.text.normalize(query)
        new_case = bool(re.match(r'^(?:outro caso|nova os|novo caso|outra os)\b', normal))
        follow_up = bool(re.match(r'^(?:mas|e |tambem|corrigindo|na verdade|complementando|nesse caso)', normal))
        answers = []
        if self.last and self.last.pendingInformation:
            # As alternativas vêm das condições, não de uma lista de equipes
            # codificada aqui. Uma resposta pode trazer outro fato junto.
            for rule in self.engine.store.for_service(service_id):
                for group in rule.get('mandatoryConditionGroups', []):
                    answers.extend(group['expressions'])
        answers_pending = bool(answers and self.engine.text.found(query, answers))
        continued = bool(self.query and service_id == self.service_id and not new_case and (follow_up or answers_pending))
        combined = self.query + '. ' + query if continued else query
        if len(combined) > 8000:
            result = self.engine.evaluate(combined, service_id)
            return result
        result = self.engine.evaluate(combined, service_id)
        result.contextApplied = continued
        if not result.errorCode:
            self.query, self.service_id, self.last = combined, service_id, result
        return result
