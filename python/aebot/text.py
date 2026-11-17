"""Normalizo a escrita, preservando os trechos originais que sustentam cada fato."""
from __future__ import annotations
import re
import unicodedata
from functools import lru_cache
from .contracts import Source

FILLERS = {"a", "o", "as", "os", "de", "da", "do", "das", "dos", "um", "uma", "em", "na", "no", "nas", "nos", "para", "pra", "pela", "pelo"}


class Text:
    def __init__(self, aliases: dict[str, str], ellipsis_terms: tuple[str, ...] = (), record_terms: tuple[str, ...] = ()):
        self.aliases = aliases
        self.ellipsis_terms = ellipsis_terms
        # O cache pertence a esta base/caso, não à função global da classe.
        # Novo caso também descarta as versões normalizadas do relato.
        self.normalize = lru_cache(maxsize=4096)(self.normalize)
        self.tokens = lru_cache(maxsize=4096)(self.tokens)
        self.record_tokens = {self.tokens(term) for term in record_terms}

    def normalize(self, value: str) -> str:
        value = "".join(char for char in unicodedata.normalize("NFD", value.casefold()) if not unicodedata.combining(char))
        return " ".join(self.aliases.get(token, token) for token in re.findall(r"[a-z0-9]+", value))

    def tokens(self, value: str) -> tuple[str, ...]:
        def singular(token):
            if len(token) > 5 and token.endswith('coes'):
                return token[:-4] + 'cao'
            if len(token) > 5 and token.endswith('ens'):
                return token[:-3] + 'em'
            return token[:-1] if len(token) > 4 and token.endswith('s') else token
        return tuple(singular(token) for token in self.normalize(value).split() if token not in FILLERS)

    def clear_cache(self) -> None:
        self.normalize.cache_clear()
        self.tokens.cache_clear()

    def consultation_subject(self, value: str) -> str:
        """Retiro só o pedido de explicação; o assunto continua literal."""
        # Não reescrevo palavras, não removo negações nem acrescento fatos.
        # O BGE compara o assunto da dúvida, não a vontade de entendê-lo.
        match = re.match(r'^\s*(?:(?:mas|e)\s+)*(?:(?:quero|gostaria de)\s+entender|'
            r'(?:me\s+)?explique|(?:pode|poderia)\s+(?:me\s+)?explicar|'
            r'qual(?:\s+[ée])?\s+a\s+(?:regra|diferença)|quais(?:\s+s[ãa]o)?\s+(?:as\s+)?(?:regras|crit[ée]rios))\s+', value, re.I)
        return value[match.end():].strip() if match and value[match.end():].strip() else value

    def consultation_parts(self, value: str) -> list[str]:
        """Separo assuntos de uma consulta, não fatos de uma OS."""
        # “Não de antes” retira um assunto. Não retiro a negação de
        # “não há foto antes”, que faz parte do critério consultado.
        included = re.split(r'\b(?:n[ãa]o (?:de|do|da|sobre)|sem falar (?:de|sobre))\b', value, maxsplit=1, flags=re.I)[0]
        parts = re.split(r'[,;]|\s+(?:e|ou|versus|vs\.?|x)\s+', included, flags=re.I)
        return [part.strip() for part in parts if part.strip()] or [included.strip()]

    def record_match(self, value: str):
        # O objeto vem do catálogo; devolvo a palavra original, com acento.
        return next((match for match in re.finditer(r'\b\w+\b', value)
            if self.tokens(match.group(0)) in self.record_tokens), None)

    def context_negated(self, prefix: str) -> bool:
        words = [word for word in self.normalize(prefix).split() if word not in FILLERS]
        return bool(re.search(r'\b(?:nao|nem)(?: (?:e|era|eram|foi|foram|esta\w*|estou|sou|somo[s]?|sao|ficou|ficaram))?$', ' '.join(words[-5:])))

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
        if not wanted:
            return False
        if context and len(wanted) == 1 and len(self.normalize(expression).split()) > 1:
            # Em contexto, remover palavras gramaticais de "dá para trocar"
            # não pode reduzir disponibilidade ao verbo "trocar" sozinho.
            literal = list(re.finditer(r'\b' + re.escape(self.normalize(expression)) + r'\b', self.normalize(value)))
            return any(not self.context_negated(self.normalize(value)[:match.start()]) for match in literal)
        if wanted and wanted[0] == 'sem' and words and words[0] == 'nem':
            # Equivalência gramatical, só na comparação. A fonte continua
            # literal: "nem sinalização" não ganha o substantivo "foto".
            return words[:len(wanted)] == ('nem',) + wanted[1:]
        if not context and wanted and wanted[0] in ('sem', 'nao', 'falta', 'faltou', 'ausente'):
            return self.has(value, expression)
        if len(wanted) < 2 and not context:
            return self.has(value, expression)
        for start, token in enumerate(words):
            if token != wanted[0]:
                continue
            if context and self.context_negated(' '.join(words[:start])):
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
        if re.search(r'\bnao falt(?:ou|a|am) so\b', value):
            return 'absence'
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
        # "Não ficou sem" nega a falta; "não só faltou" reforça a falta.
        if re.search(r'\bnao (?:e|era|eram|esta|estou|estamos|estao|estava|estavam|ficou|ficaram|ficamos) sem\b', value):
            return True
        if re.search(r'\bnao (?:(?:esta|estou|estamos|estao|estava|estavam) )?falt(?:a|am|ou|aram|ava|avam)\b(?! so\b)', value):
            return True
        return bool(re.search(r'\bnao (?:e verdade|afirmei|disse|confirmei|estou (?:afirmando|declarando|dizendo|relatando|confirmando)|impede|impossibilita)|\bnao (?:e|esta|estava|foi) (?:\w+ )?(?:incoerente|incorreto|errado|inadequado)|\bnao (?:ha|houve) (?:nenhuma? )?(?:falta|falha|problema|relato)|\bnenhuma? irregularidade\b', value))

    def uncertain(self, value: str) -> bool:
        return bool(re.search(r'\b(?:talvez|suspeita|hipotese|provavelmente|possivelmente)|\b(?:acho que|acredito que|parece que|pode ser|nao sei|nao sabemos|nao tenho certeza|nao tenho como confirmar|nao foi confirmado|nao confirmei|nao conferi|nao consultei|nao posso afirmar|nao posso confirmar|ainda preciso|preciso confirmar|preciso conferir|preciso verificar)\b', self.normalize(value)))

    def metadata(self, value: str) -> bool:
        normal = self.normalize(value)
        if re.match(r'^(?:voltando|retomando) (?:ao|a|para o|para a|o) (?:caso real|os real|os atual)\b', normal):
            return True
        if re.match(r'^(?:(?:preciso|quero|vou|devo) (?:corrigir|registrar|pontuar|ajustar|concluir|orientar)|a os (?:atual|original|de origem) e de)\b', normal):
            return True
        return bool(re.search(r'^(?:estou (?:analisando|falando|montando)|a falha que|este ultimo relato|a excecao|nao estou (?!sem\b)|nao relatando|a expressao|a frase|corrigindo(?: a informacao anterior)?$)', normal))

    def risk(self, value: str) -> bool:
        normal = self.normalize(value)
        return self.polarity(value) == 'absence' or bool(re.search(r'\b(?:errad\w*|incorret\w*|inadequad\w*|desnivelad\w*|mal|pessim\w*|ruim|diferente|difere|diverg\w*|incoer\w*|maior|menor|esquecer\w*|falt\w*|confirmei|encontrei|impede|impossibilita)\b|\b(?:ja (?:tinha|foi|havia|estava)|outra rua)|\bnao (?:bate|corresponde|fotograf\w*)\b', normal))

    def intent(self, query: str) -> str:
        normal = self.normalize(query)
        if re.search(r"^(?:(?:mas|e) )*se\b|\bcaso (?:falte|haja|nao)\b", normal):
            return "hypothesis"
        if self.consultation_subject(query) != query:
            return 'question'
        if re.match(r"^(?:(?:mas|e|entao) )*(?:qual|quais|como|quando|onde|por que|o que|me explique|quero entender)\b", normal):
            return "question"
        if "?" in query and not re.search(r"\b(?:entao (?:tiro|retiro|removo)|devo retirar|como corrijo)\b", normal):
            return "question"
        return "report"

    def general_question(self, query: str) -> bool:
        # Pedir a explicação de um critério não é declarar que ele ocorreu
        # nesta OS. Uma pergunta sobre um caso concreto mantém as devolutivas.
        normal = self.normalize(query)
        if re.search(r'\b(?:nesta|nessa|minha|esta|essa) os\b|\bestou analisando\b', normal):
            return False
        normal = re.sub(r'^(?:(?:e|mas|entao) )+', '', normal)
        return self.consultation_subject(query) != query or bool(re.match(r'^(?:qual (?:e )?a (?:regra|diferenca)|quais (?:as )?(?:regras|criterios|evidencias)|me explique|quero entender|como funciona|o que significa)\b', normal))

    def sources(self, query: str) -> list[Source]:
        # O ponto/comma separa fatos, mas o conectivo negativo continua literal.
        independent = r'e\s+(?:(?:a|o|as|os)\s+)?\w+\s+(?:foi|foram|ficou|ficaram|t[aá]|est[aá]|estava|tem|apresentou|preencheu)\b'
        new_predicate = r'e\s+(?:\w+\s+){0,3}(?:mal|p[eé]ssim\w*|ruim|inadequad\w*|incorret\w*|errad\w*)\b'
        pattern = r"[.!?;]+|,|\b(?:mas|porém|porem|só que|so que|junto com|além disso|alem disso|como tamb[eé]m)\b|(?=\b(?:nem\s+(?!sempre\b)|e\s+(?:não|nao|sem|falt\w*))\b)|\s+(?=e\s+\w+\s*(?:[.!?;,]|$))|\s+(?=" + independent + r')|\s+(?=' + new_predicate + r')'
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
            ellipsis = re.match(r'^(?:s[oó] )?(?:falta|faltou|sem)\s+(.+)$', quote, re.I)
            complement = re.sub(r'^(?:nem|e)\s+', '', normal)
            is_ellipsis = any(self.tokens(complement) == self.tokens(term) for term in self.ellipsis_terms)
            # Um complemento temporal também pode ser uma oração. Retomo o
            # predicado escrito em "nem de quando..." ou "nem o serviço
            # sendo feito", sem aplicar essa retomada a outro objeto solto.
            is_ellipsis = is_ellipsis or bool(re.match(r'^(?:de )?(?:quando|como|enquanto)\b', complement))
            is_ellipsis = is_ellipsis or bool(re.match(r'^(?:o )?(?:servico|trabalho) (?:sendo|em)\b', complement)
                and any(self.has(complement, term) for term in self.ellipsis_terms))
            is_ellipsis = is_ellipsis or bool(re.match(r'^del[ea]s?\b', complement)
                and any(self.has(complement, term) for term in self.ellipsis_terms))
            record = self.record_match(quote)
            bare_stage = record and any(self.tokens(quote[:record.start()] + quote[record.end():]) == self.tokens(term)
                for term in self.ellipsis_terms)
            if self.normalize(separator) == 'como tambem' and prefix and (is_ellipsis or bare_stage):
                # Retomo só a ausência escrita antes e uma etapa cadastrada.
                # A citação continua literal, ligada à oração que a explica.
                head = self.record_match(prefix)
                predicate = prefix[:head.start()].strip() if record and head else prefix
                model_text = predicate + ' ' + quote
            elif re.match(r'^(?:nem|e)\s+', normal) and prefix and is_ellipsis:
                model_text = prefix + " " + re.sub(r"^(?:nem|e)\s+", "", quote, flags=re.I)
            elif re.match(r'^nenhum\w*\b', normal) and result:
                # "Tem imagem..., mas nenhuma mostrando...": o pronome retoma
                # um substantivo realmente escrito; a citação não é alterada.
                noun = self.record_match(result[-1].quote)
                if noun:
                    model_text = re.sub(r'^nenhum\w*', 'Sem ' + noun.group(0), quote, flags=re.I)
                    antecedent = result[-1].quote
            elif re.match(r'^e\s+', normal) and result and is_ellipsis:
                # Coordenação retoma uma etapa escrita antes, sem fabricar
                # a citação. Isso vale também para hipóteses com "se faltar".
                before = result[-1].model_text
                head = self.record_match(before)
                if head:
                    model_text = before[:head.end()] + ' ' + re.sub(r'^e\s+', '', quote, flags=re.I)
                    antecedent = result[-1].quote
            elif result and ellipsis and any(self.tokens(ellipsis.group(1)) == self.tokens(term) for term in self.ellipsis_terms):
                noun = self.record_match(result[-1].quote)
                if noun and not record:
                    # "Tem foto durante, só falta antes": o substantivo é
                    # literal; a negação vem da oração atual. Só retomo um
                    # complemento cadastrado: "sem sinalização" é outro fato.
                    model_text = re.sub(r'\b(falta|faltou|sem)\b', lambda match: match.group(1) + ' ' + noun.group(0), quote, count=1, flags=re.I)
                    antecedent = result[-1].quote
            else:
                # Só reaproveito o predicado que realmente foi escrito antes.
                prefix_source = re.sub(r'^n[ãa]o s[oó]\s+', '', quote, flags=re.I)
                match = re.match(r"^((?:se\s+)?(?:sem|faltar|faltou)\s+\w+|n[ãa]o\s+(?:(?:há|ha|tem|houve)\s+\w+|\w+))\b", prefix_source, re.I)
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
