"""Audito a versão atual, sem ajustar motor, modelo, regras ou gabarito.

Somente perguntas sintéticas entram no relatório. Não é telemetria do chat.
"""
from __future__ import annotations
import argparse
import ctypes
from datetime import datetime, timezone, timedelta
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import statistics
import subprocess
import time
from unittest.mock import patch
from aebot.runtime import load_engine
from aebot.session import Session
from aebot import __version__
from audits.asphalt_cases import original_cases, canonical_combinations, additional_previous, novel_cases, remaining_rule_coverage

ROOT = Path(__file__).resolve().parents[1]


def stats(values):
    ordered = sorted(values)
    return dict(samples=len(values), meanMs=round(statistics.mean(values), 3),
        medianMs=round(statistics.median(values), 3),
        p95Ms=round(ordered[math.ceil(len(values) * .95) - 1], 3), maxMs=round(max(values), 3))


def hardware():
    class Memory(ctypes.Structure):
        _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong)] + [
            (name, ctypes.c_ulonglong) for name in ('total', 'available', 'totalPage', 'availablePage', 'totalVirtual', 'availableVirtual', 'extended')]
    memory = Memory()
    memory.length = ctypes.sizeof(Memory)
    good = ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(memory)) if os.name == 'nt' else False
    return dict(os=platform.platform(), python=platform.python_version(), cpu=platform.processor(),
        logicalProcessors=os.cpu_count(), physicalRamGiB=round(memory.total / 1024**3, 2) if good else None)


def check(case, result, session, engine):
    technical = bool(result.errorCode)
    decision_ok = result.decision == case['expectedDecision']
    if 'expectedScenario' in case:
        decision_ok = decision_ok and result.scenarioDecision == case['expectedScenario']
    actual = sorted(item.id for item in result.matchedRules if item.severity)
    all_ids = {item.id for item in result.matchedRules}
    basis_ok = case['expectedRules'] is None or actual == sorted(case['expectedRules'])
    basis_ok = basis_ok and (not case.get('requiredAnyRules') or bool(all_ids & set(case['requiredAnyRules'])))
    valid = {item['id'] for item in engine.store.for_service(result.serviceId)}
    for item in result.matchedRules:
        # Uma agregadora tem várias fontes, indicadas pelos IDs de suporte.
        basis_ok = basis_ok and item.id in valid and bool(item.sourceQuote)
        if item.supportingRuleIds:
            basis_ok = basis_ok and set(item.supportingRuleIds).issubset(all_ids)
        else:
            basis_ok = basis_ok and item.sourceQuote in session.query
            basis_ok = basis_ok and all(quote in session.query for quote in item.contextQuotes)
    behavior_ok = True
    for key, actual_value in [('expectedIntent', result.intent), ('contextApplied', result.contextApplied)]:
        if key in case:
            behavior_ok = behavior_ok and actual_value == case[key]
    if 'pendingRequired' in case:
        behavior_ok = behavior_ok and bool(result.pendingInformation) == case['pendingRequired']
    if case.get('pendingContains'):
        behavior_ok = behavior_ok and case['pendingContains'] in engine.text.normalize(' '.join(result.pendingInformation))
    for phrase in case.get('contentContains', []):
        behavior_ok = behavior_ok and engine.text.normalize(phrase) in engine.text.normalize(result.content)
    return dict(decisionOk=bool(decision_ok and not technical), basisOk=bool(basis_ok and not technical),
        behaviorOk=bool(behavior_ok and not technical), strictOk=bool(decision_ok and basis_ok and behavior_ok and not technical),
        technicalFailure=technical,
        wrongOfficialDecision=bool(not technical and result.decision is not None and result.decision != case['expectedDecision']),
        missedOfficialDecision=bool(not technical and result.decision is None and case['expectedDecision'] is not None))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repeat', type=int, default=3)
    parser.add_argument('--suite', choices=['main', 'complex', 'coverage', 'focused', 'holdout', 'full', 'informal', 'acceptance'], default='main')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if not 1 <= args.repeat <= 10:
        raise SystemExit('Use de 1 a 10 repetições.')
    timestamp = datetime.now(timezone(timedelta(hours=-3)))
    output = args.output or ROOT / ('python/artifacts/audit-' + timestamp.strftime('%Y-%m-%d-%H%M%S') + '.json')
    if output.exists():
        raise SystemExit('O relatório já existe; use outro nome para não confundir rodadas.')
    output.parent.mkdir(parents=True, exist_ok=True)
    report = dict(status='starting', date=timestamp.isoformat(), repeats=args.repeat, suite=args.suite,
        appVersion=__version__,
        commit=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        hardware=hardware(), criteria='Decisão oficial + cenário hipotético quando previsto + regras + comportamento pendente/correção. Casos sintéticos, não homologação operacional.',
        categories={}, rows=[])
    # A revisão Git pode ter alterações locais. Os hashes identificam a fonte
    # realmente medida sem registrar nenhum conteúdo de conversa real.
    audited = sorted((ROOT / 'python/aebot').glob('*.py')) + sorted((ROOT / 'python/audits').glob('*.py')) + [
        ROOT / 'python/audit_asphalt.py', ROOT / 'src/data/rulesStore.json',
        ROOT / 'src/data/languageAliases.json', ROOT / 'schemas/rulesStore.schema.json']
    report['sourceHashes'] = {path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in audited}
    def save():
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    save()
    print(f'Relatório novo: {output}', flush=True)
    try:
        started = time.perf_counter()
        with patch('socket.socket.connect', side_effect=AssertionError('Auditoria offline.')):
            engine = load_engine()
        report['engineInitializationMs'] = round((time.perf_counter() - started) * 1000, 3)
        report['ruleStoreVersion'] = engine.store.version
        report['modelLock'] = json.loads((ROOT / 'python/reranker.lock.json').read_text(encoding='utf-8'))
        report['selectedServices'] = ['repavimentacao-asfalto-ate-1m2', 'repavimentacao-asfalto-acima-1m2']
        if args.suite == 'acceptance':
            from audits.acceptance_cases import cases as acceptance_cases
            cases = acceptance_cases()
        elif args.suite == 'informal':
            from audits.informal_cases import cases as informal_cases
            cases = informal_cases()
        elif args.suite == 'holdout':
            from audits.asphalt_holdout import cases as holdout_cases
            cases = holdout_cases()
        elif args.suite == 'full':
            from audits.asphalt_complex_cases import cases as complex_cases
            from audits.asphalt_holdout import cases as holdout_cases
            from audits.informal_cases import cases as informal_cases
            cases = canonical_combinations(engine.store) + original_cases(ROOT) + additional_previous() + novel_cases() + complex_cases() + remaining_rule_coverage() + holdout_cases() + informal_cases()
        elif args.suite == 'focused':
            from audits.asphalt_complex_cases import cases as complex_cases
            cases = original_cases(ROOT) + additional_previous() + novel_cases() + complex_cases() + remaining_rule_coverage()
        elif args.suite == 'complex':
            from audits.asphalt_complex_cases import cases as complex_cases
            cases = complex_cases()
        elif args.suite == 'coverage':
            cases = remaining_rule_coverage()
        else:
            cases = canonical_combinations(engine.store) + original_cases(ROOT) + additional_previous() + novel_cases()
        names = list(dict.fromkeys(item['category'] for item in cases))
        report['status'] = 'running'
        for category in names:
            selected = [item for item in cases if item['category'] == category]
            print(f'Iniciando {category}: {len(selected)} cenários x {args.repeat}', flush=True)
            category_rows = []
            latencies, final_latencies, wall_scenarios = [], [], []
            for item in selected:
                row = dict(case=item, runs=[])
                for repeat in range(args.repeat):
                    session = Session(engine)
                    start = time.perf_counter()
                    evaluations = []
                    try:
                        with patch('socket.socket.connect', side_effect=AssertionError('Auditoria offline.')):
                            for query in item['turns']:
                                turn_start = time.perf_counter()
                                result = session.ask(query, item['serviceId'])
                                elapsed = (time.perf_counter() - turn_start) * 1000
                                latencies.append(elapsed)
                                evaluations.append(dict(query=query, wallMs=round(elapsed, 3), evaluation=result.to_dict()))
                        checks = check(item, result, session, engine)
                        final_latencies.append(evaluations[-1]['wallMs'])
                    except Exception as error:
                        checks = dict(decisionOk=False, basisOk=False, behaviorOk=False, strictOk=False,
                            technicalFailure=True, wrongOfficialDecision=False, missedOfficialDecision=False)
                        evaluations.append(dict(technicalException=type(error).__name__))
                    elapsed_scenario = (time.perf_counter() - start) * 1000
                    wall_scenarios.append(elapsed_scenario)
                    row['runs'].append(dict(repeat=repeat + 1, checks=checks, totalWallMs=round(elapsed_scenario, 3), turns=evaluations))
                for name in row['runs'][0]['checks']:
                    row[name] = all(run['checks'][name] for run in row['runs']) if name.endswith('Ok') else any(run['checks'][name] for run in row['runs'])
                category_rows.append(row)
            summary = dict(cases=len(selected), repeats=args.repeat,
                decisionPassed=sum(row['decisionOk'] for row in category_rows),
                strictPassed=sum(row['strictOk'] for row in category_rows),
                wrongOfficialDecisions=sum(row['wrongOfficialDecision'] for row in category_rows),
                missedOfficialDecisions=sum(row['missedOfficialDecision'] for row in category_rows),
                technicalFailures=sum(row['technicalFailure'] for row in category_rows),
                responseTime=stats(latencies), finalResponseTime=stats(final_latencies), scenarioTime=stats(wall_scenarios))
            report['rows'].extend(category_rows)
            report['categories'][category] = summary
            print(json.dumps({category: summary}, ensure_ascii=False), flush=True)
            for failed in [row for row in category_rows if not row['strictOk']][:6]:
                last = failed['runs'][0]['turns'][-1].get('evaluation', {})
                print(json.dumps(dict(failed=failed['case']['name'], expected=failed['case']['expectedDecision'],
                    actual=last.get('decision'), expectedRules=failed['case']['expectedRules'],
                    actualRules=[item['id'] for item in last.get('matchedRules', []) if item['severity']],
                    checks={key: value for key, value in failed.items() if isinstance(value, bool)}), ensure_ascii=False), flush=True)
            save()
        report['status'] = 'completed'
        report['overall'] = dict(cases=len(cases), strictPassed=sum(row['strictOk'] for row in report['rows']),
            decisionPassed=sum(row['decisionOk'] for row in report['rows']))
        turns = [turn for row in report['rows'] for run in row['runs'] for turn in run['turns'] if 'evaluation' in turn]
        inferred = [turn['wallMs'] for turn in turns if turn['evaluation']['inferenceCalls'] > 0]
        deterministic = [turn['wallMs'] for turn in turns if not turn['evaluation']['semanticApplied'] and turn['evaluation']['inferenceCalls'] == 0]
        report['timingByPath'] = {
            'actualModelCalls': stats(inferred) if inferred else None,
            'noModelCall': stats(deterministic) if deterministic else None,
            'conversationCache': 'Interpretations cleared by Session.reset between independent cases; may be reused within the same case.'}
        save()
        print(json.dumps(dict(output=str(output), overall=report['overall']), ensure_ascii=False), flush=True)
    except (Exception, KeyboardInterrupt) as error:
        report['status'] = 'interrupted' if isinstance(error, KeyboardInterrupt) else 'failed'
        report['technicalException'] = type(error).__name__
        save()
        raise


if __name__ == '__main__':
    main()
