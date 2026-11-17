"""Barro regressões sem trocar o gabarito antigo nem esconder abstenções."""
import argparse
import json
from pathlib import Path


def compare(before, after):
    if before.get('status') != 'completed' or after.get('status') != 'completed':
        raise ValueError('Compare somente auditorias concluídas; uma falha técnica não é acerto.')
    def indexed(report):
        rows = report['rows']
        result = {(row['case']['name'], row['case']['serviceId']): row for row in rows}
        if len(result) != len(rows):
            raise ValueError('Há nomes/serviços duplicados; não omito casos ao comparar.')
        return result
    old, new = indexed(before), indexed(after)
    removed = sorted(set(old) - set(new))
    changed = [key for key in old.keys() & new.keys() if old[key]['case'] != new[key]['case']]
    regressions = [key for key in old.keys() & new.keys() if old[key]['strictOk'] and not new[key]['strictOk']]
    fresh = [key for key in new if key not in old]
    fresh_failures = [key for key in fresh if not new[key]['strictOk']]
    technical = [key for key, row in new.items() if row['technicalFailure']]
    return dict(ok=not any((removed, changed, regressions, fresh_failures, technical)),
        previousCases=len(old), measuredCases=len(new), newCases=len(fresh),
        removedCases=removed, changedGold=changed, regressions=regressions,
        newDivergences=fresh_failures, technicalFailures=technical,
        retainedDivergences=[key for key in old.keys() & new.keys() if not old[key]['strictOk'] and not new[key]['strictOk']])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--before', type=Path, required=True)
    parser.add_argument('--after', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--source-root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    if args.output and args.output.exists():
        raise SystemExit('Use um relatório novo; preservo comparações anteriores.')
    after = json.loads(args.after.read_text(encoding='utf-8'))
    result = compare(json.loads(args.before.read_text(encoding='utf-8')), after)
    import hashlib
    root = args.source_root.resolve()
    mismatches = []
    for name, expected in after.get('sourceHashes', {}).items():
        file = (root / name).resolve()
        if not file.is_relative_to(root) or not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            mismatches.append(name)
    result['sourceMismatch'] = mismatches
    result['ok'] = result['ok'] and not mismatches
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))
    if not result['ok']:
        raise SystemExit('Há regressão, mudança de gabarito, omissão ou falha técnica. Revise antes de empacotar.')


if __name__ == '__main__':
    main()
