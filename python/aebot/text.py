"""Normalizo a escrita, preservando os trechos originais que sustentam cada fato."""
from __future__ import annotations
import re
import unicodedata
from .contracts import Source

FILLERS = {"a", "o", "as", "os", "de", "da", "do", "das", "dos", "um", "uma", "em", "na", "no", "nas", "nos", "para", "pra", "pela", "pelo"}


class Text:
    def __init__(self, aliases: dict[str, str]):
        self.aliases = aliases

    def normalize(self, value: str) -> str:
        value = "".join(char for char in unicodedata.normalize("NFD", value.casefold()) if not unicodedata.combining(char))
        return " ".join(self.aliases.get(token, token) for token in re.findall(r"[a-z0-9]+", value))

    def tokens(self, value: str) -> tuple[str, ...]:
        return tuple(token for token in self.normalize(value).split() if token not in FILLERS)

    def has(self, value: str, expression: str) -> bool:
        words, wanted = self.tokens(value), self.tokens(expression)
        # Nada de substring: incompleto não contém o fato completo.
        return bool(wanted) and any(words[start:start + len(wanted)] == wanted for start in range(len(words) - len(wanted) + 1))

    def found(self, value: str, expressions: list[str] | None) -> list[str]:
        return [expression for expression in expressions or [] if self.has(value, expression)]

    def missing_subject(self, value: str, expressions: list[str] | None) -> list[str]:
        words = self.tokens(value)
        matched = []
        for expression in expressions or []:
            wanted = self.tokens(expression)
            for start in range(len(words) - len(wanted) + 1):
                if wanted and words[start:start + len(wanted)] == wanted:
                    tail = ' '.join(words[start + len(wanted):])
                    # Voz passiva: "a evidência não foi apresentada". Não
                    # confundo "foto sem nitidez" com falta da própria foto.
                    if re.match(r'^nao (?:(?:foi|foram|esta|estao) )?(?:apresent|registr|mostr|envi|anex)\w*\b', tail):
                        matched.append(expression)
        return matched

    def polarity(self, value: str) -> str:
        value = self.normalize(value)
        value = re.sub(r'\bnao (?:foi|foram|esta|estao|estava|estavam) (?:sendo )?', 'nao ', value)
        if re.search(r"\b(?:nao (?:esta |estao |estava |estavam )?(?:falta|faltou|ausente)|nao (?:ha|houve) (?:falta|ausente))\b", value):
            return "present"
        if re.search(r"\b(?:sem|nem|falta|faltou|faltar|ausente|nenhum\w*|ninguem)\b|\bnao (?:ha|houve|havia|existe|existem|consta|tem|apresent\w*|registr\w*|envi\w*|mostr\w*|film\w*|veio|aparec\w*|mediu|aferiu|tir\w*|consigo|consegue|conseguiram|da)\b", value):
            return "absence"
        if re.search(r"\b(?:tem|ha|houve|havia|existe|existem|consta|apresentou|registrou|vejo|enviaram|pronto|nitida)\b|\b(?:consigo|da para|da pra) (?:ver|ler|enxergar)\b", value):
            return "present"
        return "neutral"

    def intent(self, query: str) -> str:
        normal = self.normalize(query)
        if re.search(r"^(?:e )?se\b|\bcaso (?:falte|haja|nao)\b", normal):
            return "hypothesis"
        if re.match(r"^(?:qual|quais|como|quando|onde|por que|o que|me explique|quero entender)\b", normal):
            return "question"
        if "?" in query and not re.search(r"\b(?:entao (?:tiro|retiro|removo)|devo retirar|como corrijo)\b", normal):
            return "question"
        return "report"

    def sources(self, query: str) -> list[Source]:
        # O ponto/comma separa fatos, mas o conectivo negativo continua literal.
        parts = re.split(r"[.!?;]+|,|\b(?:mas|porém|porem|só que|so que)\b|(?=\b(?:nem\s+(?!sempre\b)|e\s+(?:não|nao|sem|falt\w*))\b)", query, flags=re.I)
        result: list[Source] = []
        prefix = ""
        antecedent = None
        for part in parts:
            quote = part.strip()
            if not quote:
                continue
            normal = self.normalize(quote)
            model_text = quote
            if normal.startswith("nem ") and prefix:
                model_text = prefix + " " + re.sub(r"^nem\s+", "", quote, flags=re.I)
            elif re.match(r'^nenhum\w*\b', normal) and result:
                # "Tem imagem..., mas nenhuma mostrando...": o pronome retoma
                # um substantivo realmente escrito; a citação não é alterada.
                noun = re.search(r'\b(?:tem|há|existe|mandaram|enviaram)\s+(?:uma?\s+)?(\w+)', result[-1].quote, re.I)
                if noun:
                    model_text = re.sub(r'^nenhum\w*', 'Sem ' + noun.group(1), quote, flags=re.I)
                    antecedent = result[-1].quote
            else:
                # Só reaproveito o predicado que realmente foi escrito antes.
                match = re.match(r"^(sem\s+\w+|não\s+(?:(?:há|tem|houve)\s+\w+|\w+))\b", quote, re.I)
                prefix = match.group(1) if match else ""
                antecedent = quote if prefix else None
            result.append(Source(quote, model_text, antecedent if model_text != quote else None))
        return result
