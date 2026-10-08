# Como editar as regras do AEBOT

As regras de negócio ficam em um único arquivo: `src/data/rulesStore.json`. O motor não contém decisões específicas de serviço.

## Antes de começar

O recorte novo de Asfalto está em [Protótipo de Asfalto](PROTOTIPO-ASFALTO.md). A base atual é 2.15.1; os cadastros `RULE-ASF-*` são compartilhados por `applicableServiceIds`, não copiados entre as áreas. A revisão 2.15.1 exige impedimento relatado para a regra de trena: usar trena, sozinho, não comprova falha. Condições obrigatórias continuam verificadas no texto original, mesmo na interpretação semântica; novas formas de escrever precisam de regressão, não de liberação irrestrita do modelo.

No cadastro do serviço, `decisionPolicy: "most_severe_applicable"` faz a conclusão mais grave prevalecer entre regras realmente aplicáveis. Sem esse campo, o ranking anterior é preservado. Isso não aprova por padrão nem transforma apenas um tema relacionado em reprovação.

Quando a regra depende de contexto, use `mandatoryConditionGroups`. Todos os grupos são obrigatórios, mas basta uma expressão de cada grupo no relato original. A IA não pode preencher um grupo que o analista não informou. Exemplo:

```json
"mandatoryConditionGroups": [
  { "label": "tipo de equipe confirmado", "expressions": ["equipe interna", "equipe própria", "interna"] }
]
```

Esse exemplo exige o contexto; não decide a classificação por si só. Mantenha a pergunta em `missingInformation` na orientação que coleta o dado. Não torne todos os contextos obrigatórios: só aqueles que alteram a regra aplicável.

Abra o projeto no VS Code. O arquivo possui validação e sugestões automáticas por meio de `schemas/rulesStore.schema.json`.

Uma regra pode ser:

- **classificatória**: possui `severity` e pode recomendar `Conforme`, `Não Conforme` ou `Reprovado`;
- **orientativa**: não possui `severity`; explica o padrão, chama atenção para riscos e mantém `decision: null`. Quando aplicável, aparece como `advisory`, com ação prática e fatos ainda necessários.

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
- `missingInformation`: perguntas objetivas que o AEBOT deve devolver quando essa regra depender de um dado ausente, como superintendência, tipo de equipe ou frente do serviço. Use somente quando a informação mudar diretamente a regra aplicável.

Prefira frases completas. Termos soltos como “foto”, “antes” ou “ausência” não devem provar uma irregularidade.

## Validar e atualizar o desktop

Depois de editar, incremente a versão da base e acrescente casos ao corpus correspondente. Execute:

```powershell
npm.cmd run rules:format
npm.cmd run rules:check
npm.cmd run desktop:smoke
```

Para um pacote de atualização local, use `npm.cmd run desktop:rules -- --owner="Nome do responsável" --changes="Descrição da revisão aprovada"`. O pacote exige versão superior, responsável, vigência e descrição da revisão. Distribua pelo canal confiável definido com a TI; o nome do responsável declarado não é assinatura digital. A importação em Configurações preserva a versão anterior. Veja [Executar e testar](EXECUTAR-E-TESTAR.md). Uma regra só está pronta quando possui exemplos positivos e negativos no corpus e aceite operacional.

No perfil online **legado**, a publicação é diferente: valide `npm.cmd run build:production`, publique o Worker somente com autorização e atualize a extensão. Isso não atualiza o desktop offline.
