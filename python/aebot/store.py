"""A conclusão e a orientação vêm do JSON compartilhado, não do código Python."""
from pathlib import Path
import json
from jsonschema.validators import validator_for
from .text import Text


class RuleStore:
    def __init__(self, root: Path):
        self.root = root
        schema = json.loads((root / "schemas/rulesStore.schema.json").read_text(encoding="utf-8"))
        self.data = json.loads((root / "src/data/rulesStore.json").read_text(encoding="utf-8"))
        validator_for(schema)(schema).validate(self.data)
        self.version = self.data["version"]
        self.services = {service["id"]: service for service in self.data["services"]}
        self.rules = self.data["rules"]
        if len({rule["id"] for rule in self.rules}) != len(self.rules):
            raise ValueError("IDs de regras duplicados.")
        for rule in self.rules:
            if rule["serviceId"] not in self.services or any(item not in self.services for item in rule.get("applicableServiceIds", [])):
                raise ValueError("Regra ligada a serviço inexistente.")
        aliases = json.loads((root / "src/data/languageAliases.json").read_text(encoding="utf-8"))["aliases"]
        self.text = Text(aliases)

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
