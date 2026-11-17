"""Comparo consultas entre turnos com exemplos sintéticos, nunca com chats reais."""
import argparse
import hashlib
import json
from pathlib import Path
import statistics
import time
from unittest.mock import patch
from aebot import __version__
from aebot.runtime import load_engine
from aebot.session import Session

ROOT = Path(__file__).resolve().parents[1]
SCENARIOS = [
    ('consulta após relato semântico', 'A recomposição ficou visivelmente mal feita.',
        'E qual é a regra da foto durante?', 'RULE-ASF-FOTO-DURANTE-01'),
    ('consulta não responde equipe pendente', 'Sem aferição da vala.',
        'E me explique a regra da foto depois.', 'RULE-ASF-FOTO-DEPOIS-01'),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit('Preserve a medição anterior e escolha outro nome.')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    report = dict(status='starting', version=__version__, rows=[],
        sourceHashes={str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in (ROOT / 'python/aebot').glob('*.py')})
    def save():
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    try:
        with patch('socket.socket.connect', side_effect=AssertionError('Benchmark offline.')):
            started = time.perf_counter()
            engine = load_engine()
            report['loadMs'] = round((time.perf_counter() - started) * 1000, 3)
            for service in engine.store.services:
                for name, original, question, rule_id in SCENARIOS:
                    for repeat in range(3):
                        session = Session(engine)
                        session.ask(original, service)
                        result = session.ask(question, service)
                        report['rows'].append(dict(name=name, service=service, repeat=repeat + 1,
                            ms=result.durationMs, modelCalls=result.inferenceCalls,
                            ok=not result.errorCode and result.decision is None and not result.pendingInformation
                                and rule_id in {match.id for match in result.matchedRules}
                                and all(match.sourceQuote in question for match in result.matchedRules)))
        report.update(status='completed', meanQueryMs=round(statistics.mean(r['ms'] for r in report['rows']), 3),
            maxQueryMs=max(r['ms'] for r in report['rows']),
            passed=sum(r['ok'] for r in report['rows']))
    except Exception as error:
        report.update(status='failed', technicalException=type(error).__name__)
        raise
    finally:
        save()
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
