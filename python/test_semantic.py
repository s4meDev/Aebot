"""Casos adicionais, separados do corpus antigo. Testo o modelo real, sem rede."""
from pathlib import Path
import argparse
import json
import statistics
import time
from unittest.mock import patch
from aebot.runtime import load_engine
from aebot.session import Session
from aebot import __version__


CASES = [
    ('Não foram apresentadas fotos de como ficou o serviço no final.', 'Reprovado'),
    ('A foto final não foi apresentada.', 'Reprovado'),
    ('Sem registro de como estava a vala antes de começar.', 'Não Conforme'),
    ('Não tiraram foto com a massa sendo aplicada.', 'Não Conforme'),
    ('O número informado no relatório difere do tamanho do trecho mostrado.', 'Não Conforme'),
    ('Conferi no Field e encontrei esse serviço já encerrado em outra ordem.', 'Reprovado'),
    ('Não existe outra ordem encerrada para esse trecho no SCAE.', None),
    ('A imagem do resultado existe e está nítida.', None),
    ('Não falta foto depois.', None),
    ('A foto foi feita antes.', None),
    ('A equipe usou uma trena.', None),
    ('Quais evidências preciso conferir no asfalto?', None),
    ('O que significa duplicidade no Field?', None),
    ('Me explique a regra de qualidade do acabamento.', None),
    ('O carro da equipe estava estacionado perto.', None),
    ('Sem foto antes e não mostraram como ficou o trecho no final.', 'Reprovado'),
]


def run() -> dict:
    started = time.perf_counter()
    with patch('socket.socket.connect', side_effect=AssertionError('A análise deve ser offline.')):
        engine = load_engine()
    opening = (time.perf_counter() - started) * 1000
    rows = []
    for query, expected in CASES:
        with patch('socket.socket.connect', side_effect=AssertionError('A análise deve ser offline.')):
            result = Session(engine).ask(query, 'repavimentacao-asfalto-ate-1m2')
        rows.append(dict(query=query, expected=expected, actual=result.decision,
            ok=not result.errorCode and result.decision == expected, ms=result.durationMs,
            rules=[item.id for item in result.matchedRules], outcome=result.outcome))
        if not rows[-1]['ok']:
            print(json.dumps(rows[-1], ensure_ascii=False), flush=True)
    pairs = [('Falta um registro da execução.', 'Ausência de evidência durante a execução.'),
        ('O resultado está visível.', 'Ausência de imagem final.')]
    forward = engine.scorer.score(pairs)
    reverse = engine.scorer.score(list(reversed(pairs)))
    invariant = all(abs(a - b) < 0.00001 for a, b in zip(forward, reversed(reverse)))
    assert invariant, 'As regras não podem interferir no score umas das outras.'
    report = dict(cases=len(rows), passed=sum(row['ok'] for row in rows), openingMs=opening,
        checkedOffline=True, checkedPairIndependence=invariant,
        medianMs=statistics.median(row['ms'] for row in rows), maxMs=max(row['ms'] for row in rows), rows=rows)
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    target = args.output or Path(__file__).resolve().parent / 'artifacts/semantic-additional.json'
    if args.output and target.exists():
        raise SystemExit('Use um relatório novo; preservo medições anteriores.')
    target.parent.mkdir(parents=True, exist_ok=True)
    report = dict(status='starting', appVersion=__version__)
    def save():
        target.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    try:
        report.update(run())
        report['status'] = 'completed' if report['passed'] == report['cases'] else 'divergent'
    except Exception as error:
        report.update(status='failed', technicalException=type(error).__name__)
        raise
    finally:
        save()
    print(json.dumps({key: value for key, value in report.items() if key != 'rows'}))
    if report['status'] != 'completed':
        raise SystemExit('Há divergências semânticas. Não anuncio a rodada como aprovada.')


if __name__ == '__main__':
    main()
