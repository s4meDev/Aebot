import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalInterpretation } from '../LocalInterpretation';
import { ruleEngine } from '../../services/RuleEngine';
import { LocalModelClient } from '../../../desktop/LocalModelClient';
import { AebotAnalysisService } from '../../services/AnalysisService';

const service = ruleEngine.getServices().find((item) => item.id === 'repavimentacao-asfalto-ate-1m2')!;
const rules = ruleEngine.getRulesForService(service.id);
const ordered = rules.filter((rule) => !rule.matchPolicy?.minimumMatchedFactGroups).sort((left, right) =>
  Number(Boolean(right.severity)) - Number(Boolean(left.severity)) || left.id.localeCompare(right.id));
const index = 'RULE-ASF-FOTO-DEPOIS-01';
const request = (query: string) => createLocalInterpretation(query, service, rules.slice(0, 1), [], {}, rules, 'indexed');
afterEach(() => vi.unstubAllGlobals());

describe('protocolo local por índices', () => {
  it('não transforma uma origem explicitamente informada em falta de origem', () => {
    const query = 'A OS de origem é repavimentação concreto.';
    const parsed = request(query).parse(JSON.stringify({ m: [{ s: 0, r: 'RULE-ASF-ORIGEM-01', t: 0 }] }));
    expect(parsed?.mappings[0].stance).toBe('negated_or_present');
    expect(ruleEngine.evaluateFacts({ serviceId: service.id, query, mappings: parsed!.mappings }).decision).toBeNull();
  });
  it('uma exceção orientativa explicitamente coberta pela base não chama a IA para reinventar a resposta', async () => {
    const call = vi.fn();
    const model = new LocalModelClient(() => ({ url: 'http://127.0.0.1:9876', token: 'sintetico' }));
    model.request = call;
    const analysis = new AebotAnalysisService({ modelClient: model, humanizeDeterministicResponses: false });
    const result = await analysis.analyze({ serviceId: service.id, prompt: 'Sem aferição na OS de origem, é VCG.', history: [] });
    expect(result.decision).toBeNull();
    expect(result.content).toMatch(/não pontue/i);
    expect(result.evaluation.matchedRules.map(rule => rule.id)).toContain('RULE-ASF-ORIGEM-VCG-01');
    expect(call).not.toHaveBeenCalled();
  });
  it('preserva a oração negada para conferir dois fatos independentes', () => {
    const query = 'Não há foto da fase inicial nem de quando aplicaram a massa. Só enviaram uma imagem do asfalto concluído.';
    const local = request(query);
    const parsed = local.parse(JSON.stringify({ m: [
      { s: 0, r: 'RULE-ASF-FOTO-ANTES-01', t: 0 },
      { s: 0, r: 'RULE-ASF-FOTO-DURANTE-01', t: 0 },
      { s: 1, r: 'RULE-ASF-FOTO-DEPOIS-01', t: 0 },
    ] }));
    expect(parsed?.mappings.map(mapping => mapping.sourceQuote)).toEqual([
      'Não há foto da fase inicial nem de quando aplicaram a massa.',
      'Não há foto da fase inicial nem de quando aplicaram a massa.',
      'Só enviaram uma imagem do asfalto concluído.',
    ]);
    expect(parsed?.mappings.map(mapping => mapping.stance)).toEqual(['asserted', 'asserted', 'negated_or_present']);
    expect(ruleEngine.evaluateFacts({ serviceId: service.id, query, mappings: parsed!.mappings }).decision).toBe('Reprovado');
  });
  it('usa o contrato curto por padrão no cliente e mantém a pergunta somente no pedido atual', async () => {
    const query = 'Não enviaram nenhuma imagem de como ficou depois que terminaram de asfaltar.';
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{
      message: { content: JSON.stringify({ m: [{ s: 0, r: index, t: 0 }] }) }, finish_reason: 'stop',
    }] })));
    vi.stubGlobal('fetch', fetch);
    const model = new LocalModelClient(() => ({ url: 'http://127.0.0.1:9876', token: 'sintetico' }));
    const analysis = new AebotAnalysisService({ modelClient: model, humanizeDeterministicResponses: false });
    const result = await analysis.analyze({ serviceId: service.id, prompt: query,
      history: [{ id: 'u', role: 'user', content: query, timestamp: '09:00' }] });
    expect(result.decision).toBe('Reprovado');
    expect(fetch).toHaveBeenCalledOnce();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(model.localInterpretationProtocol).toBe('indexed');
    expect(body.max_tokens).toBe(384);
    expect(body.cache_prompt).toBe(true);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].content).toContain(index);
    expect(body.messages[0].content).not.toContain(query);
    expect(body.messages[1].content).toContain(query);
  });
  it('mantém todas as regras atômicas no prefixo fixo, sem cortar condições ou exceções', () => {
    const first = request('Relato um.');
    const second = createLocalInterpretation('Relato dois.', service, rules, ['Equipe?'], {}, rules, 'indexed');
    expect(first.systemInstruction).toBe(second.systemInstruction);
    expect(first.inputPrompt).not.toBe(second.inputPrompt);
    for (const rule of ordered) {
      expect(first.systemInstruction).toContain(rule.title);
      expect(first.systemInstruction).toContain(rule.description);
      for (const evidence of rule.relatedEvidence ?? []) expect(first.systemInstruction).toContain(evidence);
      if (rule.matchPolicy) expect(first.systemInstruction).toContain(JSON.stringify(rule.matchPolicy));
      for (const group of rule.mandatoryConditionGroups ?? []) expect(first.systemInstruction).toContain(group.label);
      for (const exception of rule.exceptions ?? []) expect(first.systemInstruction).toContain(exception);
    }
    for (const rule of rules.filter((item) => item.matchPolicy?.minimumMatchedFactGroups)) {
      expect(first.systemInstruction).not.toContain(rule.title);
    }
  });
  it('valida o ID e reconstrói a citação sem pedir ao modelo que copie o relato', () => {
    const query = 'Não enviaram nenhuma imagem de como ficou depois que terminaram de asfaltar.';
    const result = request(query).parse(JSON.stringify({ m: [{ s: 0, r: index, t: 0 }] }));
    expect(result?.mappings[0]).toMatchObject({ ruleId: index, sourceQuote: query, stance: 'asserted' });
    expect(ruleEngine.evaluateFacts({ serviceId: service.id, query, mappings: result!.mappings }).decision).toBe('Reprovado');
  });
  it('reutiliza o catálogo compartilhado sem confundir a identidade da OS', () => {
    const other = ruleEngine.getServices().find((item) => item.id === 'repavimentacao-asfalto-acima-1m2')!;
    const first = request('Relato sintético.');
    const second = createLocalInterpretation('Relato sintético.', other, [], [], {}, ruleEngine.getRulesForService(other.id), 'indexed');
    expect(first.systemInstruction).toBe(second.systemInstruction);
    expect(first.inputPrompt).toContain(service.id);
    expect(second.inputPrompt).toContain(other.id);
    expect(second.inputPrompt).not.toContain(service.id);
  });
  it('aceita orientação curta sem mapeamento ou conclusão inventada', () => {
    const result = request('Qual evidência devo conferir?').parse(JSON.stringify({ m: [], a: 'Confira as etapas.', q: '' }));
    expect(result?.conversation?.answer).toBe('Confira as etapas.');
    expect(result?.mappings).toEqual([]);
  });
  it.each([
    { m: [{ s: 99, r: index, t: 0 }] }, { m: [{ s: 0, r: 999, t: 0 }] }, { m: [{ s: 0, r: -1, t: 0 }] },
    { m: [{ s: 0, r: index, t: 4 }] }, { m: [{ s: 0, r: index, t: 0.5 }] },
    { m: [{ s: 0, r: index, t: 0, sourceQuote: 'inventado' }] }, { m: [{ s: 0, r: 'RULE-INVENTADA', t: 0 }] },
    { m: [[0, index, 0]] },
    { m: [], decision: 'Conforme' }, { m: [], a: 'a'.repeat(401) }, { m: [], q: false },
  ])('recusa índices, campos e textos fora do contrato: %j', (body) => {
    expect(request('Relato sintético.').parse(JSON.stringify(body))).toBeNull();
  });
  it('não transforma evidência presente em ausência mesmo com índice correto', () => {
    const query = 'Mandaram imagens de como ficou o asfalto pronto.';
    const result = request(query).parse(JSON.stringify({ m: [{ s: 0, r: index, t: 0 }] }));
    expect(result?.mappings[0].stance).toBe('negated_or_present');
    expect(ruleEngine.evaluateFacts({ serviceId: service.id, query, mappings: result!.mappings }).decision).toBeNull();
  });
});
