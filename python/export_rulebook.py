"""Gero o guia e o diagrama a partir da base real. Não cadastro regras aqui."""
from pathlib import Path
import hashlib
import html
import json
from aebot.store import RuleStore
from aebot.rulebook import grouped_rules, rule_details, SCOPES
from aebot.analysis_flow import AnalysisFlow, STAGES

ROOT = Path(__file__).resolve().parents[1]

def main():
    store = RuleStore(ROOT, prototype=True)
    source_hash = hashlib.sha256((ROOT / 'src/data/rulesStore.json').read_bytes()).hexdigest()
    flow = AnalysisFlow.from_store(store, source_hash)
    (ROOT / 'docs/FLUXO-ANALISE.json').write_text(json.dumps(flow.to_dict(), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'docs/FLUXO-ANALISE.mmd').write_text(flow.mermaid(), encoding='utf-8')
    (ROOT / 'docs/FLUXO-ANALISE.svg').write_text(flow.svg(), encoding='utf-8')
    categories = grouped_rules(store, next(iter(store.services)))
    heading = f'Fluxo de análise de Repavimentação Asfalto | Base {store.version}'
    steps = '\n'.join(f'<li><strong>{html.escape(item.title)}</strong><p>{html.escape(item.purpose)}</p><small>{html.escape(item.owner)}</small></li>' for item in STAGES)
    sections, markdown = [], [f'# Regras de Repavimentação Asfalto\n\nBase {store.version}. Gerado da fonte única; não edite este resumo para alterar uma regra.\n',
        f'Perfil: {store.profile["title"]}. {len(store.services)} serviços e {len(store.rules)} regras/orientações aplicáveis.\n',
        'As duas faixas compartilham regras. A aplicação continua vinculada ao serviço selecionado.\n',
        '## Fluxo geral\n\n```mermaid\nflowchart TD\n  A[Selecionar serviço e entender a pergunta] --> B[Separar fatos, etapa e escopo]\n  B --> C{Falta contexto que muda uma regra?}\n  C -- Sim --> D[Perguntar e atualizar somente esse contexto]\n  D --> B\n  C -- Não --> E[Conferir condições e exceções de todas as regras]\n  E --> F{Há regra classificatória aplicável?}\n  F -- Não --> G[Orientar com a base encontrada sem conclusão oficial]\n  F -- Sim --> H[Combinar fatos e resolver conflitos]\n  H --> I[Explicar recomendação e citar regras]\n```\n',
        'Consulta e hipótese explicam possibilidades; não classificam uma OS real. BGE relaciona linguagem, não confirma fatos.\n',
        '## Como manter\n\nEdite `src/data/rulesStore.json`. `python/catalogProfile.json` só seleciona o escopo, sem conter decisões. Depois execute `python/export_rulebook.py` e os testes.\n',
        '## Critério vigente\n\nA retificação confirmada pelo responsável em 03/11/2026 está incorporada à base 2.20.0. Consulte as condições de equipe nas regras de trena e de aferição abaixo. Sem esse contexto, a orientação deve pedir esclarecimento. O histórico anterior não prevalece sobre esta revisão da fonte única.\n']
    contexts = {item['id']: item for item in store.data['interpretation']['contexts']}
    for category, rules in categories.items():
        rows = []
        markdown.append('\n## ' + category + '\n')
        for rule in rules:
            meta = rule.get('evaluation', {})
            conditions = [SCOPES.get(meta.get('scope'), 'Escopo do relato')]
            for dimension, values in meta.get('requires', {}).items():
                conditions.append(' ou '.join(item['label'] for item in contexts[dimension]['values'] if item['id'] in values))
            conditions.extend(group['label'] for group in rule.get('mandatoryConditionGroups', []))
            if meta.get('ask'):
                conditions.append(contexts[meta['ask']]['question'])
            policy = rule.get('matchPolicy', {}).get('minimumMatchedFactGroups')
            if policy:
                conditions.append(f"Combinar {policy['count']} fatos independentes já confirmados")
            decision = rule.get('severity', 'Orientação / esclarecimento')
            details = rule_details(store, rule)
            rows.append(f'<article id="{html.escape(rule["id"])}"><div class="rule-flow">'
                f'<div><small>{html.escape(rule["id"])}</small><h3>{html.escape(rule["title"])}</h3></div>'
                f'<div class="guard"><span aria-hidden="true">→</span><p>{html.escape(" · ".join(conditions))}</p></div>'
                f'<div><strong class="decision">{html.escape(decision)}</strong><p>{html.escape(rule.get("guidance", rule["message"]))}</p></div></div>'
                f'<details><summary>Conferir condições, exceções e fonte</summary><pre>{html.escape(details)}</pre></details></article>')
            markdown.append('\n### ' + rule['title'] + '\n\n```text\n' + details + '\n```\n')
        sections.append(f'<section><h2>{html.escape(category)}</h2>{"".join(rows)}</section>')
    document = f'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>{html.escape(heading)}</title><style>
*{{box-sizing:border-box}}body{{margin:0;background:#f4f7fc;color:#14264b;font:16px/1.55 'Segoe UI',sans-serif}}
header,main,footer{{max-width:1240px;margin:auto;padding:28px}}header{{border-bottom:2px solid #d9e3f0}}h1,h2,h3{{color:#070e73;line-height:1.25}}h1{{font-size:30px}}h2{{margin-top:38px}}h3{{font-size:17px;margin:8px 0}}p{{margin:8px 0}}small,.muted{{color:#566985}}
.overview{{list-style:none;padding:0;display:grid;grid-template-columns:repeat(5,1fr);gap:16px}}.overview li{{background:white;border-top:4px solid #102a91;padding:18px}}.overview p{{font-size:14px}}
article{{background:white;border:1px solid #d9e3f0;margin:14px 0;padding:22px}}.rule-flow{{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:28px}}.guard{{display:flex;gap:18px}}.guard span{{color:#102a91;font-size:28px}}.decision{{display:block;color:#070e73}}summary{{cursor:pointer;color:#102a91;padding-top:12px}}pre{{white-space:pre-wrap;font:14px/1.65 'Segoe UI',sans-serif;border-top:1px solid #d9e3f0;padding-top:16px}}.notice{{border-left:4px solid #102a91;padding:14px 20px;background:#edf3ff}}footer{{font-size:13px;overflow-wrap:anywhere}}
@media(max-width:850px){{.overview,.rule-flow{{grid-template-columns:1fr}}.overview{{gap:8px}}.guard span{{display:none}}header,main,footer{{padding:18px}}}}
@media print{{body{{background:white}}details{{display:block}}details pre{{display:block}}article{{break-inside:avoid}}}}
</style></head><body><header><p>AEBOT · Programação de serviços</p><h1>{html.escape(heading)}</h1><p>Duas faixas de área, uma base compartilhada e exceções explícitas.</p></header>
<main><ol class="overview">{steps}</ol><aside class="notice"><strong>Como ler</strong><p>Os caminhos abaixo são condicionais. Mencionar um assunto não comprova uma falha. Uma reprovação só prevalece se sua regra for realmente aplicável. Retrabalho é ação, não uma quarta conclusão.</p><p>Quando faltar informação: perguntar → esclarecer ou retificar → reavaliar todos os fatos. Consulta ou hipótese: explicar sem classificar a OS real. Novo caso: limpar o contexto anterior.</p><p>A retificação de trena confirmada pelo responsável em 03/11/2026 está incorporada à fonte única. Confira o vínculo da equipe antes de concluir.</p><p>FLUXO-ANALISE.mmd traz o fluxograma completo; FLUXO-ANALISE.json contém as condições exatas geradas do catálogo. Esses arquivos não treinam o modelo nem substituem o motor. Edite regras somente na fonte JSON.</p></aside>{''.join(sections)}</main>
<footer>Gerado de src/data/rulesStore.json. {len(store.rules)} registros. SHA-256 da fonte: {source_hash}<p>Projeto de Pedro Lucas Botelho Naus.</p></footer></body></html>'''
    diagram = '<section><h2>Fluxograma das etapas</h2><div style="overflow:auto;background:white">' + flow.svg() + '</div><p>Os ramos de negócio e suas exceções estão detalhados abaixo, gerados da mesma fonte.</p></section>'
    document = document.replace('<main>', '<main>' + diagram, 1)
    (ROOT / 'docs/FLUXO-ASFALTO.html').write_text(document, encoding='utf-8')
    (ROOT / 'docs/REGRAS-ASFALTO.md').write_text('\n'.join(markdown), encoding='utf-8')
    print(json.dumps(dict(base=store.version, services=len(store.services), rules=len(store.rules), categories=len(categories))))


if __name__ == '__main__':
    main()
