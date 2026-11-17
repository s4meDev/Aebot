"""Comparo perfis de CPU em série, com os mesmos pares e sem conversas reais."""
import argparse
import gc
import json
from pathlib import Path
import statistics
import time
from aebot.facts import FactIndex
from aebot.reranker import LocalReranker
from aebot.runtime import verify_model
from aebot.store import RuleStore


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise SystemExit('Use um relatório novo; preservo medições anteriores.')
    root = Path(__file__).resolve().parents[1]
    store = RuleStore(root, prototype=True)
    index = FactIndex(store, next(iter(store.services)))
    # Todos os candidatos da OS atual continuam presentes; não acelero
    # retirando regras difíceis ou mudando os limites de aceitação.
    groups = index.candidates(store.data['interpretation']['defaultScope'])
    pairs = [('Não anexaram o registro de como o trecho ficou ao terminar.', index.criteria(group)) for group in groups]
    report = dict(status='running', pairs=len(pairs), runs=[])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    def save():
        args.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    save()
    reference = None
    try:
        for threads in (4, 2, 1, 4):
            scorer = LocalReranker(verify_model(root), threads=threads)
            scores = scorer.score(pairs)
            if reference is None:
                reference = scores
            difference = max(abs(a - b) for a, b in zip(reference, scores))
            samples = []
            for _ in range(3):
                started = time.perf_counter()
                assert scorer.score(pairs) == scores
                samples.append(round((time.perf_counter() - started) * 1000, 2))
            report['runs'].append(dict(threads=threads, loadMs=scorer.load_ms,
                meanMs=statistics.mean(samples), samples=samples, maxScoreDifference=difference))
            print(json.dumps(report['runs'][-1]), flush=True)
            save()
            del scorer
            gc.collect()
        report['status'] = 'completed'
    except Exception as error:
        report.update(status='failed', exception=type(error).__name__)
        raise
    finally:
        save()


if __name__ == '__main__':
    main()
