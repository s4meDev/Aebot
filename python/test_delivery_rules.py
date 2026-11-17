"""Confiro o catálogo que saiu do instalador com gabaritos já existentes."""
import argparse
import json
from pathlib import Path
import time
from unittest.mock import patch
from aebot.runtime import load_engine
from aebot.session import Session
from aebot.updates import digest
from audit_asphalt import check
from audits.document_cases import cases as document_cases
from audits.consultation_multi_cases import cases as consultation_cases


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--installed', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists():
        raise SystemExit('Preservo a rodada anterior. Use outro relatório.')
    args.report.parent.mkdir(parents=True, exist_ok=True)
    report = dict(status='starting', ok=False, source='Catálogo instalado e modelo real local; relatos sintéticos.', rows=[])
    def save():
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    try:
        resources = args.installed / 'resources'
        report['exeSha256'] = digest(args.installed / 'AEBOT.exe')
        report['catalogSha256'] = digest(resources / 'src/data/rulesStore.json')
        with patch('socket.socket.connect', side_effect=AssertionError('A análise deve continuar offline.')):
            engine = load_engine(resources)
            cases = document_cases(engine.store) + consultation_cases(engine.store)
            for case in cases:
                session = Session(engine)
                started = time.perf_counter()
                for query in case['turns']:
                    result = session.ask(query, case['serviceId'])
                report['rows'].append(dict(name=case['name'], serviceId=case['serviceId'],
                    **check(case, result, session, engine), wallMs=round((time.perf_counter()-started)*1000, 3)))
        report.update(status='completed', cases=len(cases), passed=sum(row['strictOk'] for row in report['rows']),
            technicalFailures=sum(row['technicalFailure'] for row in report['rows']),
            base=engine.store.version, services=len(engine.store.services), offline=True)
        report['ok'] = report['passed'] == report['cases'] and not report['technicalFailures']
    except Exception as error:
        report.update(status='failed', exception=type(error).__name__)
        raise
    finally:
        save()
    print(json.dumps({key: value for key, value in report.items() if key != 'rows'}, ensure_ascii=False))
    if not report['ok']:
        raise SystemExit('Há divergência na entrega. Não publico como aprovada.')


if __name__ == '__main__':
    main()
