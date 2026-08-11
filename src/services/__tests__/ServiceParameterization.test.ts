import { describe, expect, it } from 'vitest';
import rulesStoreData from '../../data/rulesStore.json';
import { parseRuleStore } from '../RuleStoreValidator';
import { describeServiceParameterization } from '../ServiceParameterization';
import { normalizeText } from '../TextNormalizer';

const store = parseRuleStore(rulesStoreData);
const repair = store.services.find((service) => service.id === 'reparo-cavalete')!;

describe('ServiceParameterization', () => {
  it('lista somente o tipo de parametrização solicitado', () => {
    const answer = describeServiceParameterization(
      normalizeText('Quais adicionais executados estão disponíveis?'),
      repair,
      store.services
    );

    expect(answer).toContain('Adicional Executado:');
    expect(answer).toContain('Desobstrução de Ramal de Água');
    expect(answer).not.toContain('Adicional Posterior:');
    expect(answer).not.toContain('Troca de Serviço:');
  });

  it('entende pergunta informal no plural sobre trocas', () => {
    const answer = describeServiceParameterization(
      normalizeText('Quais trocas eu posso fazer aqui?'),
      repair,
      store.services
    );
    expect(answer).toContain('Troca de Serviço:');
    expect(answer).toContain('Substituição de Registro de Cavalete');
  });

  it('entende desdobro como os dois tipos de adicional', () => {
    const answer = describeServiceParameterization(
      normalizeText('Quais desdobros posso usar?'),
      repair,
      store.services
    );

    expect(answer).toContain('Adicional Executado:');
    expect(answer).toContain('Adicional Posterior:');
  });

  it('não usa correspondência parcial de palavra', () => {
    const answer = describeServiceParameterization(
      normalizeText('Essa condição é incondicional?'),
      repair,
      store.services
    );
    expect(answer).toBeNull();
  });
});
