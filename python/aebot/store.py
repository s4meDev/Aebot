"""A conclusão e a orientação vêm do JSON compartilhado, não do código Python."""
from pathlib import Path
from copy import deepcopy
import json
from jsonschema.validators import validator_for
from .text import Text


class RuleStore:
    def __init__(self, root: Path, *, prototype: bool = False):
        self.root = root
        schema = json.loads((root / "schemas/rulesStore.schema.json").read_text(encoding="utf-8"))
        self.data = json.loads((root / "src/data/rulesStore.json").read_text(encoding="utf-8"))
        validator_for(schema)(schema).validate(self.data)
        self.version = self.data["version"]
        self.services = {service["id"]: service for service in self.data["services"]}
        if len(self.services) != len(self.data['services']):
            raise ValueError('IDs de serviços duplicados.')
        self.rules = self.data["rules"]
        if len({rule["id"] for rule in self.rules}) != len(self.rules):
            raise ValueError("IDs de regras duplicados.")
        for rule in self.rules:
            if rule["serviceId"] not in self.services or any(item not in self.services for item in rule.get("applicableServiceIds", [])):
                raise ValueError("Regra ligada a serviço inexistente.")
        interpretation = self.data.get('interpretation', {})
        scopes = [item['id'] for item in interpretation.get('scopes', [])]
        contexts = {item['id']: item for item in interpretation.get('contexts', [])}
        if len(scopes) != len(set(scopes)) or len(contexts) != len(interpretation.get('contexts', [])):
            raise ValueError('IDs de interpretação duplicados.')
        if interpretation and interpretation['defaultScope'] not in scopes:
            raise ValueError('Escopo padrão inexistente.')
        for context in contexts.values():
            ids = [item['id'] for item in context['values']]
            if len(ids) != len(set(ids)):
                raise ValueError('Valores de contexto duplicados.')
        for rule in self.rules:
            for policy_name in ('minimumGroups', 'minimumMatchedFactGroups'):
                policy = rule.get('matchPolicy', {}).get(policy_name)
                if policy and policy['count'] > len(policy['groups']):
                    raise ValueError('Quantidade mínima maior que os grupos cadastrados.')
            meta = rule.get('evaluation')
            if not meta:
                continue
            if meta['scope'] not in scopes or (meta.get('ask') and meta['ask'] not in contexts):
                raise ValueError('Regra com escopo ou contexto inexistente.')
            for dimension, values in list(meta.get('requires', {}).items()) + list(meta.get('incompatible', {}).items()):
                if dimension not in contexts or not set(values).issubset({item['id'] for item in contexts[dimension]['values']}):
                    raise ValueError('Regra com valor de contexto inexistente.')
        aliases = json.loads((root / "src/data/languageAliases.json").read_text(encoding="utf-8"))["aliases"]
        ellipsis_terms = tuple(expression for context in contexts.values() if context.get('perStatement')
            for value in context['values'] for expression in value['expressions'])
        self.text = Text(aliases, ellipsis_terms, tuple(interpretation.get('recordTerms', [])))
        self.profile = None
        if prototype:
            profile_schema = json.loads((root / 'schemas/catalogProfile.schema.json').read_text(encoding='utf-8'))
            profile = json.loads((root / 'python/catalogProfile.json').read_text(encoding='utf-8'))
            validator_for(profile_schema)(profile_schema).validate(profile)
            if any(item not in self.services for item in profile['serviceIds']):
                raise ValueError('O perfil aponta para um serviço inexistente.')
            self.profile = profile
            self.data = self.project(profile['serviceIds'])
            # Valido também a projeção que vai dentro do EXE. O histórico
            # de outros serviços não participa do protótipo nem do pacote.
            validator_for(schema)(schema).validate(self.data)
            self.services = {item['id']: item for item in self.data['services']}
            self.rules = self.data['rules']

    def project(self, service_ids: list[str]) -> dict:
        """Seleciono dados da base, sem reescrever conclusão ou orientação."""
        if not service_ids or len(set(service_ids)) != len(service_ids) or any(item not in self.services for item in service_ids):
            raise ValueError('Seleção de serviços inválida.')
        result = deepcopy(self.data)
        result['services'] = [deepcopy(self.services[item]) for item in service_ids]
        for service in result['services']:
            # Relações com o catálogo legado não devem deixar IDs órfãos.
            if 'parameterization' in service:
                service['parameterization'] = {key: [item for item in values if item in service_ids]
                    for key, values in service['parameterization'].items()}
        selected = {rule['id']: rule for service_id in service_ids for rule in self.for_service(service_id)}
        result['rules'] = []
        for original in self.rules:
            if original['id'] not in selected:
                continue
            rule = deepcopy(original)
            applicable = [item for item in service_ids if rule in self.for_service(item)]
            rule['serviceId'] = applicable[0]
            if len(applicable) > 1:
                rule['applicableServiceIds'] = applicable[1:]
            else:
                rule.pop('applicableServiceIds', None)
            result['rules'].append(rule)
        return result

    def for_service(self, service_id: str) -> list[dict]:
        if service_id not in self.services:
            return []
        active = self.services[service_id].get("analysisStatus") != "rules_pending"
        return [rule for rule in self.rules if rule["serviceId"] == service_id
            or service_id in rule.get("applicableServiceIds", []) or (active and rule.get("appliesToAllActiveServices"))]

    def constraints(self, query: str, rule: dict) -> bool:
        if self.text.found(query, rule.get("exceptions")):
            return False
        if any(not self.text.has(query, expression) for expression in rule.get("mandatoryConditions", [])):
            return False
        return all(self.text.found(query, group["expressions"]) for group in rule.get("mandatoryConditionGroups", []))

    def criteria(self, rule: dict) -> list[str]:
        return rule.get("semanticCriteria") or [rule["title"] + ". " + rule["description"]]
