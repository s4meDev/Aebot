"""Projeto as regras em um mapa de manutenção. O mapa não decide uma OS."""
from copy import deepcopy
from dataclasses import asdict, dataclass
import html


@dataclass(frozen=True)
class AnalysisStage:
    id: str
    title: str
    owner: str
    purpose: str


STAGES = (
    AnalysisStage('input', 'Serviço e intenção', 'aebot/session.py', 'Separar consulta, hipótese e relato real; não acumular uma dúvida como ocorrência.'),
    AnalysisStage('facts', 'Fatos e citações', 'aebot/extraction.py', 'Relacionar linguagem à base, preservando citação, negação e fatos independentes.'),
    AnalysisStage('context', 'Escopo e contexto', 'aebot/facts.py', 'Separar atual, origem e adicional; suspender contexto incerto e aceitar retificação.'),
    AnalysisStage('guards', 'Condições e exceções', 'aebot/engine.py', 'Conferir todos os critérios necessários; desconhecido não satisfaz uma condição.'),
    AnalysisStage('combine', 'Todas as regras aplicáveis', 'aebot/engine.py', 'Combinar fatos já confirmados e resolver conflitos pela política do serviço.'),
    AnalysisStage('reply', 'Orientação e fundamentos', 'aebot/response.py', 'Apresentar a avaliação sem inventar regra nem transformar orientação em aprovação.'),
)


@dataclass(frozen=True)
class AnalysisFlow:
    version: str
    source_hash: str
    services: tuple[dict, ...]
    interpretation: dict
    rules: tuple[dict, ...]

    @classmethod
    def from_store(cls, store, source_hash):
        return cls(store.version, source_hash, tuple(deepcopy(list(store.services.values()))),
            deepcopy(store.data.get('interpretation', {})), tuple(deepcopy(store.rules)))

    def to_dict(self):
        return dict(schema=1, generated=True, authoritativeSource='src/data/rulesStore.json',
            ruleStoreVersion=self.version, sourceSha256=self.source_hash,
            stages=[asdict(item) for item in STAGES], services=list(self.services),
            interpretation=self.interpretation, rules=list(self.rules))

    def mermaid(self):
        """Os ramos de regra vêm do cadastro, inclusive as agregadoras."""
        lines = ['flowchart TD',
            '  input["Selecionar serviço e identificar intenção"] --> intent{"Consulta, hipótese ou OS real?"}',
            '  intent -->|Consulta| consult["Explicar caminhos da base sem declarar ocorrência"]',
            '  intent -->|Hipótese| scenario["Isolar fatos simulados; não classificar a OS real"]',
            '  intent -->|OS real| facts["Separar fatos, citações, etapa e escopo"]',
            '  scenario --> facts',
            '  facts --> certain{"Fatos e contexto suficientemente claros?"}',
            '  certain -->|Não| ask["Perguntar só o detalhe que muda a orientação"]',
            '  ask -->|Esclarecimento ou retificação| facts',
            '  certain -->|Sim| guards["Conferir condições e exceções de TODAS as regras"]',
            '  guards --> applicable{"Há regras classificatórias realmente aplicáveis?"}',
            '  applicable -->|Não| partial["Orientar com a base encontrada; decisão nula"]',
            '  applicable -->|Sim| combine["Combinar fatos independentes; resolver conflitos pelo serviço"]',
            '  combine --> reply["Explicar recomendação, ações e todas as regras utilizadas"]',
            '  consult --> topics["Recuperar TODOS os assuntos pedidos; preservar citação e escopo"]',
            '  topics --> unknown{"Algum assunto ainda está ambíguo?"}',
            '  unknown -->|Sim| clarify["Orientar o que foi entendido e pedir só o outro assunto"]',
            '  clarify -->|Esclarecimento da consulta; não altera OS| topics',
            '  unknown -->|Não| finish["Analista confere a OS antes de concluir no sistema"]',
            '  partial --> finish', '  reply --> finish',
            '  finish -->|Nova OS| input',
            '  finish -->|Complemento do mesmo caso| facts',
            '', '  subgraph catalog["Ramos gerados da fonte única; não são outra base de decisão"]']
        labels = {item['id']: item for item in self.interpretation.get('contexts', [])}
        nodes = {}
        for index, rule in enumerate(self.rules):
            node = f'r{index}'
            nodes[rule['id']] = node
            meta = rule.get('evaluation', {})
            guards = [meta['scope']] if meta.get('scope') else []
            for dimension, values in meta.get('requires', {}).items():
                guards.append(' ou '.join(value['label'] for value in labels[dimension]['values'] if value['id'] in values))
            if meta.get('ask'):
                guards.append(labels[meta['ask']]['question'])
            guards.extend(group['label'] for group in rule.get('mandatoryConditionGroups', []))
            guards.extend(rule.get('mandatoryConditions', []))
            if rule.get('exceptions') or meta.get('incompatible'):
                guards.append('conferir exceções do cadastro')
            label = rule['id'] + ' — ' + rule['title'] + '\n' + ('; '.join(guards) or 'Confirmar fato e condições cadastradas') + '\n' + rule.get('severity', 'Orientação / pergunta; sem decisão oficial')
            escaped = html.escape(label, quote=True).replace('\n', '<br/>')
            lines.append(f'    {node}["{escaped}"]')
        for rule in self.rules:
            policy = rule.get('matchPolicy', {}).get('minimumMatchedFactGroups')
            if policy:
                for support in self.rules:
                    if support.get('factGroup') in policy['groups']:
                        lines.append(f'    {nodes[support["id"]]} -->|fato independente confirmado| {nodes[rule["id"]]}')
        lines.append('  end')
        return '\n'.join(lines) + '\n'

    def svg(self):
        """Desenho as etapas técnicas, sem cadastrar conclusões neste mapa."""
        nodes = [
            ('entry', 330, 15, 'Serviço selecionado + mensagem atual'),
            ('intent', 330, 105, 'Consulta, hipótese ou relato real?'),
            ('consult', 10, 105, 'Consulta: explicar sem confirmar fato'),
            ('topics', 10, 215, 'Recuperar todos os assuntos da consulta'),
            ('unknown', 10, 315, 'Outro assunto ainda está ambíguo?'),
            ('clarify', 10, 415, 'Orientar o conhecido e pedir o outro ponto'),
            ('scenario', 650, 105, 'Hipótese: isolar da OS real'),
            ('facts', 330, 215, 'Fatos, citações, negação e etapas'),
            ('context', 330, 315, 'Escopo e contexto suficientemente claros?'),
            ('ask', 650, 315, 'Perguntar só o detalhe necessário'),
            ('guards', 330, 415, 'Conferir condições e exceções'),
            ('applicable', 330, 515, 'Há classificatórias aplicáveis?'),
            ('partial', 10, 515, 'Orientar sem conclusão oficial'),
            ('combine', 330, 615, 'Combinar TODOS os fatos confirmados'),
            ('resolve', 330, 715, 'Resolver conflitos pela política do serviço'),
            ('answer', 330, 815, 'Resposta curta + todos os fundamentos'),
        ]
        labels = ''.join(f'<g id="flow-{key}"><rect x="{x}" y="{y}" width="300" height="56" rx="8"/><text x="{x + 150}" y="{y + 32}" text-anchor="middle">{html.escape(label)}</text></g>' for key, x, y, label in nodes)
        paths = ['M480 71V105', 'M330 133H310', 'M630 133H650', 'M480 161V215',
            'M800 161V243H630', 'M480 271V315', 'M630 343H650', 'M800 315V243H630',
            'M480 371V415', 'M480 471V515', 'M330 543H310', 'M480 571V615',
            'M480 671V715', 'M480 771V815', 'M160 161V215', 'M160 271V315',
            'M160 371V415', 'M10 443H5V243H10', 'M310 343H320V843H330', 'M160 571V843H330']
        arrows = ''.join(f'<path d="{path}" fill="none" marker-end="url(#arrow)"/>' for path in paths)
        captions = '<text x="320" y="123" text-anchor="end">Consulta</text><text x="640" y="123">Hipótese</text><text x="490" y="195">OS real</text><text x="635" y="333">Não</text><text x="490" y="401">Sim</text><text x="320" y="505" text-anchor="end">Não</text><text x="490" y="602">Sim</text><text x="660" y="204">Esclarecimento / retificação</text><text x="170" y="401">Sim</text><text x="315" y="330" text-anchor="end">Não</text>'
        return ('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="900" viewBox="0 0 960 900" role="img" aria-labelledby="flow-title flow-desc">'
            '<title id="flow-title">Etapas da análise do AEBOT</title><desc id="flow-desc">Consulta explica sem ocorrência; hipótese fica isolada. Relato passa por fatos, contexto, condições e exceções. Falta de informação gera pergunta. Todas as regras aplicáveis são combinadas antes da resposta.</desc>'
            '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#163b81"/></marker></defs>'
            '<style>rect{fill:#fff;stroke:#163b81;stroke-width:1.4}text{font:14px Segoe UI, sans-serif;fill:#13264c}path[marker-end]{stroke:#163b81;stroke-width:1.5}</style>' + arrows + labels + captions + '</svg>')
