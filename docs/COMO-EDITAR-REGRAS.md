# Como editar as regras do AEBOT

As regras de negócio ficam em um único arquivo: `src/data/rulesStore.json`. O motor não contém decisões específicas de serviço.

## Antes de começar

Abra o projeto no VS Code. O arquivo possui validação e sugestões automáticas por meio de `schemas/rulesStore.schema.json`.

Uma regra pode ser:

- **classificatória**: possui `severity` e pode recomendar `Conforme`, `Não Conforme` ou `Reprovado`;
- **orientativa**: não possui `severity`; explica o padrão, chama atenção para riscos e mantém `decision: null`.

Nunca use uma conclusão apenas porque parece lógica. Cadastre `severity` somente quando a regra de análise tiver definido o resultado oficial.

## Adicionar uma regra orientativa

Copie um objeto existente dentro de `rules`, troque o ID e ajuste os textos:

```json
{
  "id": "RULE-SERVICO-INFO-01",
  "serviceId": "id-do-servico",
  "title": "Título curto",
  "description": "O que a regra verifica.",
  "priority": 4,
  "attentionLevel": "attention",
  "conditionKeywords": ["frase completa que descreve o caso"],
  "equivalentExpressions": ["outra forma informal de dizer a mesma coisa"],
  "topicKeywords": ["assunto usado em perguntas"],
  "examples": ["Exemplo real e anonimizado."],
  "message": "Explicação curta para o analista.",
  "guidance": "Ação objetiva recomendada."
}
```

## Transformar um cenário em decisão

Adicione somente uma destas opções:

```json
"severity": "Conforme"
```

```json
"severity": "Não Conforme"
```

```json
"severity": "Reprovado"
```

Se a conclusão ainda não estiver confirmada, deixe `severity` ausente. `attentionLevel: "critical"` pode destacar um caso crítico sem inventar uma decisão.

## Reaproveitar a mesma regra

Quando o conteúdo for realmente idêntico em vários serviços, mantenha uma só regra e use os IDs existentes:

```json
"serviceId": "servico-principal",
"applicableServiceIds": ["segunda-variacao", "terceira-variacao"]
```

Não copie a mesma regra várias vezes e não escreva decisões em TypeScript.

Uma orientação que seja realmente igual para **todos os serviços ativos** pode usar `"appliesToAllActiveServices": true`. Não combine esse campo com `applicableServiceIds`.

## Campos que melhoram a interpretação

- `conditionKeywords`: frases que já descrevem o cenário completo.
- `equivalentExpressions`: sinônimos e formas informais específicas do caso.
- `positiveSignals`: termos como “sem”, “faltou” e “não mostrou”.
- `negativeSignals`: termos que informam presença, correção ou exceção.
- `relatedEvidence`: objeto, etapa ou evidência à qual o sinal se refere.
- `topicKeywords`: termos usados apenas para localizar uma orientação em perguntas.
- `examples`: frases reais, sem dados pessoais.
- `sourceReferences`: origem opcional da orientação.

Prefira frases completas. Termos soltos como “foto”, “antes” ou “ausência” não devem provar uma irregularidade.

## Validar antes de publicar

Execute:

```powershell
npm run rules:format
npm run rules:check
npm run build:production
```

Depois incremente a versão da base, publique o Worker e recarregue a extensão. Uma regra só está pronta quando possui exemplos positivos e negativos no corpus de regressão.
