"""Executo o corpus antigo sem modificar as respostas esperadas para esconder erros."""
from pathlib import Path
import argparse
import json
import statistics
from aebot.store import RuleStore
from aebot.engine import Engine
from aebot.reranker import LocalReranker
from aebot.session import Session


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--lexical', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    model = None if args.lexical else LocalReranker(root / 'python/models/bge')
    engine = Engine(RuleStore(root), model)
    cases = json.loads((root / 'src/data/asphaltPilotCases.json').read_text(encoding='utf-8'))
    rows = []
    for case in cases:
        session = Session(engine)
        if case.get('previous'):
            session.ask(case['previous'], case['serviceId'])
        result = session.ask(case['query'], case['serviceId'])
        actual = sorted(item.id for item in result.matchedRules if item.severity)
        expected = sorted(case.get('expectedClassifyingRuleIds', []))
        # Hipótese explica uma conclusão condicional, não classifica uma OS real.
        decision = result.scenarioDecision if result.intent == 'hypothesis' else result.decision
        ok = not result.errorCode and decision == case['decision'] and actual == expected
        row = dict(name=case['name'], ok=ok, expected=case['decision'], actual=decision,
            expectedRules=expected, actualRules=actual, ms=result.durationMs,
            intent=result.intent, outcome=result.outcome, question=result.pendingInformation)
        rows.append(row)
        if not ok:
            print(json.dumps(row, ensure_ascii=False), flush=True)
    report = dict(corpus='asphaltPilotCases.json (sessão real; hipótese comparada como cenário)', cases=len(rows),
        passed=sum(row['ok'] for row in rows), modelLoadMs=model.load_ms if model else None,
        medianMs=statistics.median(row['ms'] for row in rows), maxMs=max(row['ms'] for row in rows), rows=rows)
    print(json.dumps({key: value for key, value in report.items() if key != 'rows'}, ensure_ascii=False))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
