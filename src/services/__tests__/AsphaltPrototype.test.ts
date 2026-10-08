import { describe, expect, it } from 'vitest';
import cases from '../../data/asphaltPilotCases.json';
import { RuleEngine, ruleEngine } from '../RuleEngine';
import store from '../../data/rulesStore.json';
import { AebotAnalysisService } from '../AnalysisService';

const services = ['repavimentacao-asfalto-ate-1m2', 'repavimentacao-asfalto-acima-1m2'];

describe('protótipo de Repavimentação Asfalto', () => {
  it('a IA não pode usar fotos presentes como declaração de conferência completa para aprovar', () => {
    const rule = ruleEngine.getRulesForService(services[0]).find(item => item.id === 'RULE-ASF-CONFORME-01')!;
    const query = 'As imagens mostram o resultado final.';
    const result = ruleEngine.evaluateFacts({ serviceId: services[0], query, mappings: [{
      ruleId: rule.id, sourceQuote: query, canonicalExpression: rule.conditionKeywords[0], stance: 'asserted',
    }] });
    expect(result.decision).toBeNull();
  });
  it('uma frase sobre outra OS não comprova excesso de adicional', () => {
    const rule = ruleEngine.getRulesForService(services[0]).find(item => item.id === 'RULE-ASF-DESDOBRO-EXCESSO-01')!;
    const query = 'Consultei no Field e confirmei que não existe outra ordem encerrada para esse mesmo trecho.';
    const result = ruleEngine.evaluateFacts({ serviceId: services[0], query, mappings: [{
      ruleId: rule.id, sourceQuote: query, canonicalExpression: rule.conditionKeywords[0], stance: 'asserted',
    }] });
    expect(result.decision).toBeNull();
    expect(result.matchedRules.some(item => item.id === rule.id && result.outcome === 'decision')).toBe(false);
  });
  it('negar outra ordem encerrada também não afirma falta de vínculo de origem', () => {
    const rule = ruleEngine.getRulesForService(services[0]).find(item => item.id === 'RULE-ASF-ORIGEM-01')!;
    const query = 'Consultei no Field e confirmei que não existe outra ordem encerrada para esse mesmo trecho.';
    const result = ruleEngine.evaluateFacts({ serviceId: services[0], query, mappings: [{
      ruleId: rule.id, sourceQuote: query, canonicalExpression: rule.conditionKeywords[0], stance: 'asserted',
    }] });
    expect(result.decision).toBeNull();
  });
  // O mesmo cadastro atende os dois tamanhos; comparar IDs também detecta regras indevidas.
  for (const serviceId of services) {
    // Paráfrases reservadas ao modelo real não viram supostos testes de matching lexical.
    it.each(cases.filter((item) => !('requiresSemantic' in item)))(`${serviceId}: $name`, (item) => {
      const result = ruleEngine.evaluatePrompt(item.query, serviceId);
      expect(result.decision).toBe(item.decision);
      if (result.outcome === 'decision') {
        expect(result.matchedRules.filter((rule) => rule.severity).map((rule) => rule.id).sort())
          .toEqual([...(item.expectedClassifyingRuleIds ?? item.expectedAppliedRuleIds ?? [])].sort());
      }
      if (item.decision === null) expect(result.decision).not.toBe('Conforme');
    });
  }

  it('a regra combinada mantém as duas evidências que a sustentam', () => {
    const result = ruleEngine.evaluatePrompt('Sem foto antes nem durante.', services[0]);
    expect(result.primaryRule?.supportingRuleIds?.sort()).toEqual(['RULE-ASF-FOTO-ANTES-01', 'RULE-ASF-FOTO-DURANTE-01']);
  });

  it('não leva as regras novas do asfalto para calçada, bloco ou cerâmica sem confirmação', () => {
    for (const serviceId of ['repavimentacao-calcada', 'repavimentacao-bloco-paralelo', 'repavimentacao-ceramica']) {
      expect(ruleEngine.getRulesForService(serviceId).some((rule) => rule.id.startsWith('RULE-ASF-'))).toBe(false);
    }
  });

  it('continua o caso e pergunta o tipo de equipe sem repetir a pergunta após a resposta', async () => {
    const service = new AebotAnalysisService({ modelClient: null });
    const previous = 'Sem aferição da vala.';
    const first = await service.analyze({ serviceId: services[0], prompt: previous, history: [] });
    expect(first.decision).toBeNull();
    const history = [
      { id: 'u', role: 'user' as const, content: previous, timestamp: '09:00' },
      { id: 'a', role: 'assistant' as const, content: first.content, timestamp: '09:01',
        pendingInformation: first.evaluation.advisory?.missingInformation },
    ];
    const internal = await service.analyze({ serviceId: services[0], prompt: 'interna', history });
    expect(internal.decision).toBe('Não Conforme');
    expect(internal.content).toMatch(/retrabalho/i);
    expect(internal.evaluation.insufficiencyReason).toBeUndefined();
    const third = await service.analyze({ serviceId: services[0], prompt: 'terceirizada', history });
    expect(third.decision).toBe('Reprovado');
  });

  it('política inválida é recusada e o padrão antigo permanece nos outros serviços', () => {
    const changed = structuredClone(store);
    Object.assign(changed.services[0], { decisionPolicy: 'approve_default' });
    expect(() => new RuleEngine(changed)).toThrow(/decisionPolicy/);
    expect(ruleEngine.getServices()[0].decisionPolicy).toBe('ranked');
  });

  it.each(['antes', 'durante', 'depois'])('não inventa ausência explicitamente negada: %s', (stage) => {
    const result = ruleEngine.evaluatePrompt(`Não faltou foto ${stage}.`, services[0]);
    expect(result.decision).toBeNull();
  });

  it.each(['antes', 'durante', 'depois'])('preserva não tem foto: %s', (stage) => {
    const result = ruleEngine.evaluatePrompt(`Não tem foto ${stage}.`, services[0]);
    expect(result.decision).toBe(stage === 'depois' ? 'Reprovado' : 'Não Conforme');
  });

  it('cancelamento permanece orientação operacional, nunca quarta conclusão', () => {
    const result = ruleEngine.evaluatePrompt('Execução incompatível sem opção de troca.', services[0]);
    expect(result.decision).toBe('Reprovado');
    expect(result.primaryRule?.guidance).toMatch(/cancelamento/);
  });

  it('uma reprovação confirmada vence uma não conformidade mais específica', () => {
    const data = structuredClone(store);
    const service = data.services.find((item) => item.id === services[0])!;
    // O serviço e a política vêm do cadastro; o motor não conhece Asfalto por nome.
    expect(service.decisionPolicy).toBe('most_severe_applicable');
    const result = new RuleEngine(data).evaluatePrompt('Formulário preenchido incorretamente e vala errada.', service.id);
    expect(result.decision).toBe('Reprovado');
    expect(result.matchedRules.some((rule) => rule.severity === 'Não Conforme')).toBe(true);
  });

  it('a IA não pode inventar o vínculo da equipe para aplicar retrabalho', () => {
    const rule = ruleEngine.getRulesForService(services[0]).find((item) => item.id === 'RULE-PAV-AFERICAO-INTERNA-01')!;
    const query = 'Usaram trena, mas ninguém consegue saber o tamanho do trecho.';
    const result = ruleEngine.evaluateFacts({ serviceId: services[0], query, mappings: [{
      ruleId: rule.id, sourceQuote: query, canonicalExpression: rule.conditionKeywords[0], stance: 'asserted',
    }] });
    expect(result.decision).toBeNull();
    expect(result.hasSufficientEvidence).toBe(false);
  });

  it('a alternativa de contexto da equipe própria continua válida', () => {
    expect(ruleEngine.evaluatePrompt('Equipe própria não mostrou a aferição da vala.', services[0]).decision).toBe('Não Conforme');
  });

  it('grupos obrigatórios desconhecidos ou vazios falham na validação', () => {
    for (const groups of [[], [{ label: 'contexto', expressions: [] }], [{ label: 'contexto', expressions: ['confirmado'], extra: true }]]) {
      const changed = structuredClone(store);
      Object.assign(changed.rules[0], { mandatoryConditionGroups: groups });
      expect(() => new RuleEngine(changed)).toThrow();
    }
  });
});
