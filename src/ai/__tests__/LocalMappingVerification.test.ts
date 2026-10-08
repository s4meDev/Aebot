import { describe, expect, it, vi } from 'vitest';
import { createLocalMappingVerification, preferExplicitLocalEvidence } from '../LocalMappingVerification';
import { ruleEngine } from '../../services/RuleEngine';
import { AebotAnalysisService } from '../../services/AnalysisService';
import type { SemanticInterpretation } from '../../services/SemanticInterpreter';
import { evidenceCatalog } from '../EvidenceInterpretation';

const service = ruleEngine.getServices()[0];
const rules = ruleEngine.getRulesForService(service.id);
const [first, second] = rules.filter((rule) => rule.severity && !rule.matchPolicy?.minimumMatchedFactGroups);
const interpretation: SemanticInterpretation = { mappings: [first, second].map((rule) => ({
  ruleId: rule.id, sourceQuote: 'Relato sintético.', canonicalExpression: rule.conditionKeywords[0], stance: 'asserted',
})), canonicalPrompt: 'Texto técnico', conversation: { answer: 'Narrativa anterior.' } };

describe('conferência local de associações múltiplas', () => {
  it('confere citações separadas da mesma regra e não deixa uma presença indevida cancelar a falta', () => {
    const input: SemanticInterpretation = { mappings: [
      { ...interpretation.mappings[0], sourceQuote: 'Evidência de outro momento presente.', stance: 'negated_or_present' },
      { ...interpretation.mappings[0], sourceQuote: 'A evidência necessária não foi apresentada.', stance: 'asserted' },
    ], canonicalPrompt: null };
    const request = createLocalMappingVerification('Relato sintético.', service, rules, input, true)!;
    expect(request.schema.required).toEqual(['0', '1']);
    expect(request.prompt).toContain('negated_or_present');
    expect(request.parse('{"0":false,"1":true}')?.mappings).toEqual([input.mappings[1]]);
    expect(request.parse('{"0":true,"1":false}')?.mappings).toEqual([input.mappings[0]]);
  });
  it('reutiliza catálogo de sistema com chaves curtas sem aceitar confirmação livre', () => {
    const short = createLocalMappingVerification('Relato sintético.', service, rules, interpretation, true)!;
    const full = createLocalMappingVerification('Relato sintético.', service, rules, interpretation)!;
    expect(short.prompt.length).toBeLessThan(full.prompt.length);
    expect(short.prompt).toContain(first.id);
    expect(short.prompt).toContain(first.description);
    expect(short.parse('{"0":true,"1":false}')?.mappings.map((mapping) => mapping.ruleId)).toEqual([first.id]);
    for (const value of ['{"0":true}', '{"0":true,"1":"true"}', '{"0":true,"1":false,"2":true}']) {
      expect(short.parse(value)).toBeNull();
    }
  });
  it('usa conceitos dos dados para descartar associação vaga num fato simples', () => {
    const catalog = [{ ...first, relatedEvidence: ['documento de apoio'] }, { ...second, relatedEvidence: ['local da intervenção'] }];
    const input = { ...interpretation, mappings: interpretation.mappings.map((mapping) => ({ ...mapping, sourceQuote: 'Não apresentaram o documento de apoio.' })) };
    const result = preferExplicitLocalEvidence(input, catalog);
    expect(result.mappings.map((mapping) => mapping.ruleId)).toEqual([first.id]);
    expect(result.conversation).toBeUndefined();
  });
  it('preserva paráfrases sem âncora literal e fatos ligados por coordenação', () => {
    const catalog = [{ ...first, relatedEvidence: ['documento de apoio'] }, { ...second, relatedEvidence: ['local da intervenção'] }];
    for (const quote of ['Não apresentaram o registro solicitado.', 'Não apresentaram o documento de apoio e houve outra falha.']) {
      const input = { ...interpretation, mappings: interpretation.mappings.map((mapping) => ({ ...mapping, sourceQuote: quote })) };
      expect(preferExplicitLocalEvidence(input, catalog)).toBe(input);
    }
  });
  it('pode excluir uma regra, mas não inventar outra nem preservar narrativa incompatível', () => {
    const request = createLocalMappingVerification('Relato sintético.', service, rules, interpretation)!;
    const checked = request.parse(JSON.stringify({ [first.id]: true, [second.id]: false }));
    expect(checked?.mappings.map((mapping) => mapping.ruleId)).toEqual([first.id]);
    expect(checked?.conversation).toBeUndefined();
    expect(checked?.canonicalPrompt).toBeNull();
  });
  it('preserva a resposta quando todos os fatos foram confirmados', () => {
    const request = createLocalMappingVerification('Relato sintético.', service, rules, interpretation)!;
    expect(request.parse(JSON.stringify({ [first.id]: true, [second.id]: true }))).toBe(interpretation);
  });
  it('recusa campo extra, confirmação omitida e valor que não seja booleano', () => {
    const request = createLocalMappingVerification('Relato sintético.', service, rules, interpretation)!;
    for (const value of [{ [first.id]: true }, { [first.id]: true, [second.id]: 'true' },
      { [first.id]: true, [second.id]: true, inventada: true }]) expect(request.parse(JSON.stringify(value))).toBeNull();
  });
  it('não abre segunda chamada para fato único ou falhas explicitamente negadas', () => {
    expect(createLocalMappingVerification('Relato.', service, rules, { ...interpretation, mappings: interpretation.mappings.slice(0, 1) })).toBeUndefined();
    expect(createLocalMappingVerification('Relato.', service, rules, { ...interpretation,
      mappings: interpretation.mappings.map((mapping) => ({ ...mapping, stance: 'negated_or_present' })) })).toBeUndefined();
  });
  it.each([false, true])('integra filtragem e falha técnica segura: %s', async (failure) => {
    const chassi = rules.find((rule) => rule.conditionKeywords.includes('chassi ilegível'))!;
    const parameter = rules.find((rule) => rule.conditionKeywords.includes('faltou adicional executado'))!;
    const evidence = Object.fromEntries([...evidenceCatalog(rules).keys()].map((key) => [key, { state: 'not_mentioned', sourceIds: [] }]));
    const request = vi.fn().mockResolvedValueOnce({ provider: 'local', status: 'ok', text: JSON.stringify({
      intent: 'report', evidence, mappings: [chassi, parameter].map((rule) => ({ sourceId: 0, ruleId: rule.id, stance: 'asserted' })),
      conversation: { answer: 'Confira a identificação.', question: '' },
    }) }).mockResolvedValueOnce(failure ? { provider: 'local', status: 'api_error' }
      : { provider: 'local', status: 'ok', text: JSON.stringify({ [chassi.id]: true, [parameter.id]: false }) });
    const analysis = new AebotAnalysisService({ modelClient: { provider: 'local', providerChain: ['local'], cacheKey: 'verificação-teste', request },
      humanizeDeterministicResponses: false });
    const result = await analysis.analyze({ serviceId: service.id, prompt: 'Não dá pra ler o chassi e o adicional executado está lançado.', history: [] });
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.decision).toBe(failure ? null : 'Não Conforme');
    if (!failure) expect(result.evaluation.semanticMappings?.map((mapping) => mapping.ruleId)).toEqual([chassi.id]);
    else expect(result.fallbackReason).toBe('api_error');
  });
});
