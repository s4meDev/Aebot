"""Normalizo a escrita, preservando os trechos originais que sustentam cada fato."""
from __future__ import annotations
import re
import unicodedata
from functools import lru_cache
from .contracts import Source

FILLERS = {"a", "o", "as", "os", "de", "da", "do", "das", "dos", "um", "uma", "em", "na", "no", "nas", "nos", "para", "pra", "pela", "pelo"}


class Text:
    def __init__(self, aliases: dict[str, str]):
        self.aliases = aliases

    @lru_cache(maxsize=4096)
    def normalize(self, value: str) -> str:
        value = "".join(char for char in unicodedata.normalize("NFD", value.casefold()) if not unicodedata.combining(char))
        return " ".join(self.aliases.get(token, token) for token in re.findall(r"[a-z0-9]+", value))

    @lru_cache(maxsize=4096)
    def tokens(self, value: str) -> tuple[str, ...]:
        def singular(token):
            if len(token) > 5 and token.endswith('coes'):
                return token[:-4] + 'cao'
            if len(token) > 5 and token.endswith('ens'):
                return token[:-3] + 'em'
            return token[:-1] if len(token) > 4 and token.endswith('s') else token
        return tuple(singular(token) for token in self.normalize(value).split() if token not in FILLERS)

    def regular(self, value: str) -> bool:
        normal = self.normalize(value)
        return not self.risk(value) and bool(re.search(r'\b(?:corret\w*|adequad\w*|nivelado|nivelada|nitid\w*|legiv\w*|bom|boa|coerente)\b|\b(?:bate|confere|coincide) com\b', normal))

    def has(self, value: str, expression: str) -> bool:
        words, wanted = self.tokens(value), self.tokens(expression)
        # Nada de substring: incompleto não contém o fato completo.
        return bool(wanted) and any(words[start:start + len(wanted)] == wanted for start in range(len(words) - len(wanted) + 1))

    def flexible(self, value: str, expression: str, *, context: bool = False) -> bool:
        def plural(token):
            return token[:-1] if len(token) > 4 and token.endswith('s') else token
        words = tuple(map(plural, self.tokens(value)))
        wanted = tuple(map(plural, self.tokens(expression)))
        if not context and wanted and wanted[0] in ('sem', 'nao', 'falta', 'faltou', 'ausente'):
            return self.has(value, expression)
        if len(wanted) < 2:
            return self.has(value, expression)
        for start, token in enumerate(words):
            if token != wanted[0]:
                continue
            position = start
            for target in wanted[1:]:
                next_index = next((i for i in range(position + 1, min(position + 4, len(words))) if words[i] == target), None)
                if next_index is None or any(word in ('nao', 'nem', 'sem') for word in words[position + 1:next_index]):
                    break
                position = next_index
            else:
                return True
        return False

    def absent_target(self, value: str, expression: str) -> bool:
        if self.missing_subject(value, [expression]):
            return True
        words, wanted = self.tokens(value), self.tokens(expression)
        for start in range(len(words) - len(wanted) + 1):
            if words[start:start + len(wanted)] == wanted:
                prefix = ' '.join(words[max(0, start - 5):start])
                prefix = re.sub(r'\bnao (?:foi|foram|esta|estao|estava|estavam) ', 'nao ', prefix)
                if re.search(r'\besquece\w*(?: \w+)?$', prefix) and not self.denied(prefix):
                    return True
                if re.search(r'\bninguem (?:mostr\w*|envi\w*|fotograf\w*|registr\w*|apresent\w*|anex\w*)$', prefix):
                    return True
                if re.search(r'\bdeix(?:ou|aram) de\b', self.normalize(value)) and re.search(r'\bdeix(?:ou|aram) \w+$', prefix):
                    return True
                if re.search(r'(?:\b(?:sem|nem|falta|faltou|faltar|faltam|ausencia|ausente)|\bnao (?:(?:ha|houve|tem|tiver|possui|apresent\w*|registr\w*|envi\w*|mostr\w*|mand\w*|film\w*|fotograf\w*|tir\w*|anex\w*|sub\w*|fornec\w*|produz\w*|deram|entreg\w*|receb\w*|document\w*)))\s*(?:nenhum\w*)?$', prefix):
                    return True
        return False

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
                    verbs = r'(?:apresent|registr|mostr|envi|anex|fotograf|lanc|cadastr|inclu)\w*\b'
                    direct = r'^nao (?:(?:foi|foram|esta|estao) )?' + verbs
                    relative = r'^(?:\w+ ){1,3}nao (?:foi|foram) ' + verbs
                    if re.match(direct, tail) or re.match(relative, tail):
                        matched.append(expression)
        return matched

    def polarity(self, value: str) -> str:
        value = self.normalize(value)
        if self.denied(value):
            return 'present'
        if re.search(r'\b(?:esquece[ur]\w*|esqueceram|deix(?:ou|aram) de (?:anexar|registrar|enviar|lancar|cadastrar|mostrar|fotografar))\b', value):
            return 'absence'
        value = re.sub(r'\bnao (?:foi|foram|esta|estao|estava|estavam) (?:sendo )?', 'nao ', value)
        if re.search(r"\b(?:nao (?:esta |estao |estava |estavam )?(?:falta|faltou|ausente)|nao (?:ha|houve) (?:falta|ausente))\b", value):
            return "present"
        if re.search(r"\b(?:sem|nem|falta|faltou|faltar|faltam|ausente|nenhum\w*|ninguem)\b|\bnao (?:ha|houve|havia|existe|existem|consta|tem|tiver|feit\w*|apresent\w*|registr\w*|envi\w*|mand\w*|fotograf\w*|mostr\w*|lanc\w*|cadastr\w*|inclu\w*|film\w*|anex\w*|sub\w*|fornec\w*|produz\w*|deram|entreg\w*|receb\w*|document\w*|veio|aparec\w*|mediu|aferiu|tir\w*|consigo|consegue|conseguiram|da)\b", value):
            return "absence"
        if re.search(r"\b(?:tem|ha|houve|havia|existe|existem|consta|apresentou|registrou|vejo|enviaram|pronto|nitida|presente|presentes|apresentad\w*|registrad\w*|evidenciad\w*|corret\w*|concluid\w*|visive\w*)\b|\b(?:consigo|da para|da pra) (?:ver|ler|enxergar)\b|\b(?:foi|foram) (?:feit\w*|tirad\w*|enviad\w*|anexad\w*)\b", value):
            return "present"
        return "neutral"

    def denied(self, value: str) -> bool:
        value = self.normalize(value)
        if re.search(r'\bnao esquece\w*', value):
            return True
        return bool(re.search(r'\bnao (?:e verdade|afirmei|disse|confirmei|estou afirmando|estou declarando|impede|impossibilita)|\bnao (?:e|esta|estava|foi) (?:\w+ )?(?:incoerente|incorreto|errado|inadequado)|\bnao (?:ha|houve) (?:nenhuma? )?(?:falta|falha|problema|relato)|\b(?:nenhuma? irregularidade|nao faltou|nao falta|nao esta falta(?:ndo)?)\b', value))

    def uncertain(self, value: str) -> bool:
        return bool(re.search(r'\b(?:talvez|suspeita|hipotese)|\b(?:nao sei|nao confirmei|nao conferi|nao consultei|nao posso afirmar|nao posso confirmar|ainda preciso|preciso confirmar|preciso conferir|preciso verificar)\b', self.normalize(value)))

    def metadata(self, value: str) -> bool:
        normal = self.normalize(value)
        if re.match(r'^(?:(?:preciso|quero|vou|devo) (?:corrigir|registrar|pontuar|ajustar|concluir|orientar)|a os (?:atual|original|de origem) e de)\b', normal):
            return True
        return bool(re.search(r'^(?:estou (?:analisando|falando|montando)|a falha que|este ultimo relato|a excecao|nao estou|nao relatando|a expressao|a frase|corrigindo(?: a informacao anterior)?$)', normal))

    def risk(self, value: str) -> bool:
        normal = self.normalize(value)
        return self.polarity(value) == 'absence' or bool(re.search(r'\b(?:errad\w*|incorret\w*|inadequad\w*|desnivelad\w*|mal|diferente|difere|diverg\w*|incoer\w*|maior|menor|esquecer\w*|falt\w*|confirmei|encontrei|impede|impossibilita)\b|\b(?:ja (?:tinha|foi|havia|estava)|outra rua)|\bnao (?:bate|corresponde|fotograf\w*)\b', normal))

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
        independent = r'e\s+(?:(?:a|o|as|os)\s+)?\w+\s+(?:foi|foram|ficou|ficaram|t[aá]|est[aá]|estava|tem|apresentou|preencheu)\b'
        pattern = r"[.!?;]+|,|\b(?:mas|porém|porem|só que|so que)\b|(?=\b(?:nem\s+(?!sempre\b)|e\s+(?:não|nao|sem|falt\w*))\b)|\s+(?=e\s+\w+\s*(?:[.!?;,]|$))|\s+(?=" + independent + r')'
        parts = []
        start, separator = 0, ''
        for boundary in re.finditer(pattern, query, re.I):
            parts.append((query[start:boundary.start()], separator))
            start, separator = boundary.end(), boundary.group(0)
        parts.append((query[start:], separator))
        result: list[Source] = []
        prefix = ""
        antecedent = None
        for part, separator in parts:
            quote = part.strip()
            if not quote:
                continue
            normal = self.normalize(quote)
            model_text = quote
            context_link = None
            relationship = None
            if re.match(r'^(?:nem|e)\s+', normal) and prefix and not re.match(independent, quote, re.I) and not re.match(r'^(?:e|nem)\s+(?:nao|sem|falt\w*)\b', normal):
                model_text = prefix + " " + re.sub(r"^(?:nem|e)\s+", "", quote, flags=re.I)
            elif re.match(r'^nenhum\w*\b', normal) and result:
                # "Tem imagem..., mas nenhuma mostrando...": o pronome retoma
                # um substantivo realmente escrito; a citação não é alterada.
                noun = re.search(r'\b(?:tem|há|existe|mandaram|enviaram)\s+(?:uma?\s+)?(\w+)', result[-1].quote, re.I)
                if noun:
                    model_text = re.sub(r'^nenhum\w*', 'Sem ' + noun.group(1), quote, flags=re.I)
                    antecedent = result[-1].quote
            elif re.match(r'^e\s+', normal) and result:
                # Coordenação retoma uma etapa escrita antes, sem fabricar
                # a citação. Isso vale também para hipóteses com "se faltar".
                before = result[-1].model_text
                head = re.match(r'^(.*?\b(?:foto|registro|imagem|evidência)\b)', before, re.I)
                if head:
                    model_text = head.group(1) + ' ' + re.sub(r'^e\s+', '', quote, flags=re.I)
                    antecedent = result[-1].quote
            elif result and re.match(r'^(?:so )?(?:falta|faltou|sem)\s+', normal):
                noun = re.search(r'\b(?:foto|registro|imagem|evidência)\b', result[-1].quote, re.I)
                if noun and not re.search(r'\b(?:foto|registro|imagem|evidência)\b', quote, re.I):
                    # "Tem foto durante, só falta antes": o substantivo é
                    # literal; a negação vem da oração atual, não da anterior.
                    model_text = re.sub(r'\b(falta|faltou|sem)\b', lambda match: match.group(1) + ' ' + noun.group(0), quote, count=1, flags=re.I)
                    antecedent = result[-1].quote
            else:
                # Só reaproveito o predicado que realmente foi escrito antes.
                match = re.match(r"^((?:se\s+)?(?:sem|faltar|faltou)\s+\w+|n[ãa]o\s+(?:(?:há|ha|tem|houve)\s+\w+|\w+))\b", quote, re.I)
                prefix = match.group(1) if match else ""
                antecedent = quote if prefix else None
                if not prefix and result and re.match(r'^(?:pel[ao]s? (?:imagens|fotos)|por (?:elas|eles|isso)|isso\b)', normal):
                    context_link = result[-1].quote
                    relationship = 'reference'
                if result and re.match(r'^nem\b', normal):
                    context_link = result[-1].quote
                    relationship = 'coordination'
                if result and re.match(r'^(?:so )?(?:nao tem|ficou|ficaram)\b', normal):
                    context_link = result[-1].quote
                    relationship = 'reference'
            if not context_link and result and self.normalize(separator) in ('mas', 'porem', 'so que'):
                context_link, relationship = result[-1].quote, 'contrast'
            result.append(Source(quote, model_text, antecedent if model_text != quote else context_link,
                relationship='coordination' if model_text != quote else relationship))
        return result
