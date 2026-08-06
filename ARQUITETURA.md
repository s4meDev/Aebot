# Arquitetura do AEBOT

Este arquivo é o mapa de manutenção do projeto. A ordem abaixo acompanha o caminho percorrido por uma pergunta, da extensão até a resposta e o feedback.

## 1. Visão geral

O AEBOT tem três partes executáveis:

1. **Extensão Chrome** (`src`): mostra o side panel e conversa com a API.
2. **Cloudflare Worker** (`worker`): API online usada pelos analistas em produção.
3. **Servidor Node** (`server`): alternativa local para desenvolvimento e contingência.

As três partes usam o mesmo motor em `src/services`. As regras de negócio existem uma única vez, em `src/data/rulesStore.json`.

```text
Pergunta no side panel
  -> serviço selecionado
  -> contexto explícito da conversa
  -> API online
  -> normalização e identificação da intenção
  -> busca e comparação das regras
  -> resolução determinística da decisão
  -> IA opcional organiza a explicação
  -> resposta curta no side panel
```

A IA não decide. Ela pode reconhecer uma forma informal de escrever e melhorar o texto final, mas só pode usar regras e expressões já cadastradas.

## 2. Caminho de uma análise

### 2.1 Inicialização da extensão

- `manifest.json` declara o side panel, o service worker e as permissões da extensão Manifest V3.
- `src/background.ts` abre o side panel quando o usuário clica no ícone.
- `index.html` é a página carregada pelo Chrome.
- `src/main.tsx` monta o React.
- `src/App.tsx` carrega configurações, serviço, histórico e provider; depois conecta os componentes.

### 2.2 Interface e serviço selecionado

- `src/components/ServiceSelector.tsx` permite escolher o serviço.
- `src/components/ServiceDetails.tsx` mostra informações do serviço.
- `src/components/ChatPanel.tsx` mantém as mensagens e envia a pergunta atual separada do histórico. Isso evita duplicar a pergunta no prompt.
- `src/components/ConfigModal.tsx` configura API, credencial e opções locais.
- `src/components/FeedbackModal.tsx` envia somente o feedback digitado conscientemente pelo analista.

O `serviceId` escolhido na tela acompanha toda a avaliação. Serviço vazio ou desconhecido gera erro controlado; nunca existe troca silenciosa para outro serviço.

### 2.3 Transporte até o backend

- `src/ai/BackendClient.ts` faz as chamadas HTTP tipadas.
- `src/ai/BackendProvider.ts` usa a API como caminho principal e controla a contingência embarcada.
- `src/api/contracts.ts` define os contratos compartilhados da API.
- `src/api/FeedbackClient.ts` envia feedback.
- `src/api/feedbackContracts.ts` valida o formato do feedback.

O fallback embarcado só pode decidir quando conhece o serviço e comprova que a versão local da base é igual à versão central. Sem essa garantia, a resposta fica sem decisão.

### 2.4 Preparação do caso

- `src/services/ConversationContextResolver.ts` junta mensagens somente quando há continuação ou correção explícita. Um novo caso limpa o contexto.
- `src/services/TextNormalizer.ts` remove diferenças de acento, caixa, pontuação e espaços sem usar substring ingênua.
- `src/services/QueryIntentClassifier.ts` separa relato afirmativo, hipótese, pergunta informativa e intenção insuficiente.
- `src/services/SemanticInterpreter.ts` permite que um modelo associe linguagem livre somente a expressões cadastradas.

### 2.5 Recuperação e decisão

- `src/services/RuleRetriever.ts` encontra todas as regras aplicáveis, registra os motivos do match e trata condições orientadas pelos dados.
- `src/services/SemanticRuleRetriever.ts` acrescenta candidatos semânticos permitidos, sem criar regra nova.
- `src/services/ConflictResolver.ts` ordena compatibilidade, fatos, especificidade, relevância, prioridade e gravidade.
- `src/services/RuleEngine.ts` coordena a avaliação determinística e devolve decisão, evidências, conflitos, confiança e necessidade de validação humana.
- `src/services/ResponseFormatter.ts` gera a resposta curta de contingência.
- `src/services/AnalysisService.ts` executa o mesmo fluxo na extensão, no servidor Node e no Worker.

Se nenhuma regra realmente aplicável for encontrada, `decision` é `null`. O sistema não usa decisão padrão para aprovar.

### 2.6 Uso opcional de IA

- `src/ai/StructuredModelClient.ts` define o contrato que qualquer modelo deve cumprir.
- `src/ai/WorkersAiModelClient.ts` integra o modelo disponível no Cloudflare Worker.
- `src/ai/OllamaModelClient.ts` integra um modelo local opcional.
- `src/ai/GeminiProvider.ts` mantém o nome histórico, mas hoje coordena o motor e qualquer cliente estruturado configurado.
- `src/ai/PromptBuilder.ts` entrega ao modelo a avaliação já calculada e proíbe alteração da decisão.

O modelo serve para conectar linguagem informal e humanizar. A decisão recebida do motor é imutável.

### 2.7 Resposta e feedback

- A resposta volta pelo backend e é exibida por `ChatPanel.tsx`.
- O feedback segue para `POST /v1/feedback` sem copiar automaticamente a conversa.
- `worker/feedbackRepository.ts` grava o registro no D1.
- `worker/adminPage.ts` fornece a página protegida para leitura e tratamento dos feedbacks.

## 3. Fonte de verdade e dependências

As dependências devem apontar nesta direção:

```text
dados e tipos
  -> serviços puros do motor
  -> orquestração da análise
  -> API/providers
  -> interface e pontos de entrada
```

Regras que evitam acoplamento:

- regra de negócio fica no JSON, nunca em `RuleEngine` ou componentes;
- a interface não calcula decisão;
- providers e modelos não alteram decisão;
- Worker e Node reutilizam `AnalysisService`;
- arquivos de teste podem conhecer casos reais, mas o motor genérico não conhece IDs `RULE-RC`;
- tokens e chaves ficam fora do repositório.

## 4. Pastas e arquivos

### Raiz

- `AGENTS.md`: decisões permanentes que futuras manutenções precisam respeitar.
- `ARQUITETURA.md`: este mapa do código.
- `PROJETO.md`: visão do produto, requisitos e planejamento das sprints.
- `README.md`: instalação, comandos e operação diária.
- `package.json`: dependências, versão e comandos do projeto.
- `package-lock.json`: versões exatas instaladas pelo npm.
- `manifest.json`: manifesto-fonte da extensão.
- `index.html`: entrada HTML do side panel.
- `vite.config.ts`: build da extensão e cópia do service worker/manifesto.
- `vite.server.config.ts`: build da API Node.
- `wrangler.jsonc`: configuração, bindings e limites do Cloudflare Worker.
- `tsconfig.json`: TypeScript da extensão e do código compartilhado.
- `tsconfig.node.json`: TypeScript dos arquivos de build e scripts compatíveis.
- `tsconfig.server.json`: TypeScript da API Node.
- `tsconfig.worker.json`: TypeScript do Worker.
- `.env.example`: nomes das variáveis locais, sempre sem segredos.
- `.gitignore`: arquivos gerados e privados que não entram no Git.

### `src` — extensão e núcleo compartilhado

- `main.tsx`: entrada do React.
- `App.tsx`: composição da tela, estado persistido e escolha do provider.
- `background.ts`: service worker Manifest V3.
- `styles.css`: tema e layout do side panel.
- `types.ts`: tipos de serviço, regra, avaliação e mensagens.
- `localConfig.ts`: leitura segura das configurações locais de build.
- `chrome.d.ts`: tipos mínimos das APIs Chrome usadas pelo projeto.
- `vite-env.d.ts`: tipos fornecidos pelo Vite.

#### `src/components`

- `ChatPanel.tsx`: conversa, envio, estados de carregamento e exibição da avaliação.
- `ConfigModal.tsx`: configurações operacionais da instalação.
- `FeedbackModal.tsx`: formulário de feedback voluntário.
- `ServiceDetails.tsx`: resumo do serviço selecionado.
- `ServiceSelector.tsx`: seleção explícita do serviço.

#### `src/data`

- `rulesStore.json`: serviços e regras de negócio; é a fonte de verdade funcional.
- `languageAliases.json`: abreviações e equivalências gerais de linguagem.
- `regressionCases.json`: frases reais que protegem o comportamento esperado da base.

#### `src/services`

- `AnalysisService.ts`: fachada compartilhada que executa uma análise completa.
- `ConversationContextResolver.ts`: continuação, retificação e novo caso.
- `TextNormalizer.ts`: normalização e tokens inteiros.
- `QueryIntentClassifier.ts`: intenção e força da afirmação.
- `RuleRetriever.ts`: recuperação, score e motivos de correspondência.
- `SemanticRuleRetriever.ts`: combinação segura de candidatos semânticos.
- `SemanticInterpreter.ts`: valida a interpretação limitada produzida pela IA.
- `ConflictResolver.ts`: escolhe a regra principal sem descartar as demais.
- `RuleEngine.ts`: coordena o resultado determinístico tipado.
- `ResponseFormatter.ts`: formata respostas sem depender de IA.
- `RuleStoreValidator.ts`: valida a estrutura da base em tempo de execução.
- `ServiceCatalogService.ts`: expõe catálogo e versão da base.
- `KnowledgeService.ts`: consulta detalhes e regras de um serviço.
- `__tests__`: testes unitários e corpus de regressão do motor.

#### `src/ai`

- `BackendClient.ts`: cliente HTTP da API.
- `BackendProvider.ts`: provider usado pela extensão e política de fallback.
- `GeminiProvider.ts`: orquestra motor, interpretação e humanização.
- `PromptBuilder.ts`: prompts restritos ao resultado e às regras recuperadas.
- `StructuredModelClient.ts`: interface comum para modelos.
- `WorkersAiModelClient.ts`: adaptador do Workers AI.
- `OllamaModelClient.ts`: adaptador do Ollama local.
- `__tests__`: contratos, falhas e garantias dos providers.

#### `src/api`

- `contracts.ts`: requisições e respostas da análise e do catálogo.
- `FeedbackClient.ts`: cliente HTTP do feedback.
- `feedbackContracts.ts`: tipos e validação de feedback.
- `__tests__`: testes dos contratos e do cliente.

#### Apoio da extensão

- `src/constants/storageKeys.ts`: nomes únicos das chaves persistidas.
- `src/storage/StorageAdapter.ts`: usa `chrome.storage` e memória controlada em testes.
- `src/state/usePersistentState.ts`: hook React para estado persistente.
- `src/repositories/serviceRepository.ts`: acesso local ao catálogo embarcado.

### `worker` — backend online

- `index.ts`: entrada do Cloudflare Worker.
- `app.ts`: rotas, autenticação, CORS, limites e chamada do serviço de análise.
- `feedbackRepository.ts`: operações tipadas no banco D1.
- `adminPage.ts`: HTML, CSS e JavaScript da página administrativa.
- `migrations/0001_feedback.sql`: criação inicial das tabelas de feedback.
- `__tests__`: testes de API, segurança, capacidade e banco simulado.

### `server` — backend Node local

- `index.ts`: inicia o servidor HTTP.
- `app.ts`: rotas, CORS, autenticação e limites locais.
- `analysisService.ts`: monta as dependências do serviço compartilhado.
- `config.ts`: interpreta configurações locais.
- `environment.ts`: acesso tipado às variáveis de ambiente.
- `contracts.ts`: valida entradas recebidas pelo servidor.
- `__tests__`: testes da alternativa Node.

### `scripts` — operação e validação

- `audit-rules.mjs`: procura lacunas, duplicidades e conflitos na base.
- `validate-extension.mjs`: confere o artefato Manifest V3.
- `validate-production-extension.mjs`: garante que o build de produção só acesse a API oficial.
- `validate-server.mjs`: confere o bundle Node.
- `check-server.mjs`: teste rápido da API Node em execução.
- `check-local-ai.mjs`: verifica a IA local opcional.
- `setup-local-server.mjs`: prepara a configuração local sem versionar segredo.
- `configure-production-extension.mjs`: aplica URL e identidade estável no `dist`.
- `configure-cloudflare-secrets.mjs`: envia hashes e configurações privadas ao Cloudflare sem imprimi-los.
- `generate-access-tokens.mjs`: cria credenciais individuais dos analistas.
- `generate-admin-token.mjs`: cria a credencial separada do painel administrativo.
- `generate-extension-identity.mjs`: cria e preserva a identidade estável da extensão.
- `token-provisioning.mjs`: funções puras de geração, hash e serialização de tokens.
- `verify-production-deployment.mjs`: testa catálogo, análise, feedback e painel publicados.
- `run-capacity-test.mjs`: executa o teste de 3.000 avaliações isoladamente.
- `__tests__`: testes das rotinas de provisionamento.

### `docs` — operação e governança

- `DEPLOYMENT-40-USERS.md`: publicação e distribuição para os 40 analistas.
- `CAPACITY-3000-OS.md`: premissas de volume, limites e teste de capacidade.
- `RULE-INTAKE.md`: processo para cadastrar e revisar regras.

### Arquivos de teste

Os testes ficam perto da parte que protegem:

- `src/services/__tests__/ConversationContextResolver.test.ts`: novo caso, continuação e correção de fatos.
- `src/services/__tests__/RegressionCorpus.test.ts`: todas as frases cadastradas no corpus de regressão.
- `src/services/__tests__/RuleEngine.test.ts`: decisões, intenções, conflitos, múltiplas regras e serviços.
- `src/services/__tests__/RuleStoreValidator.test.ts`: schema e integridade da base.
- `src/services/__tests__/SemanticInterpreter.test.ts`: limites da interpretação feita pelo modelo.
- `src/services/__tests__/SemanticRuleRetriever.test.ts`: união segura de matches textuais e semânticos.
- `src/services/__tests__/ServiceCatalogService.test.ts`: catálogo e versão central.
- `src/ai/__tests__/BackendClient.test.ts`: requisições, respostas e falhas HTTP.
- `src/ai/__tests__/BackendProvider.test.ts`: backend preferencial e regras do fallback.
- `src/ai/__tests__/GeminiProvider.test.ts`: decisão imutável, histórico e humanização.
- `src/ai/__tests__/OllamaModelClient.test.ts`: contrato do modelo local.
- `src/ai/__tests__/WorkersAiModelClient.test.ts`: contrato do modelo Cloudflare.
- `src/api/__tests__/FeedbackClient.test.ts`: envio e erros do feedback.
- `src/api/__tests__/feedbackContracts.test.ts`: validação e limpeza dos campos de feedback.
- `server/__tests__/analysisService.test.ts`: montagem da análise no Node.
- `server/__tests__/app.test.ts`: rotas, CORS, autenticação e limites do Node.
- `server/__tests__/config.test.ts`: leitura da configuração local.
- `server/__tests__/contracts.test.ts`: validação das entradas da API Node.
- `server/__tests__/environment.test.ts`: variáveis de ambiente permitidas.
- `worker/__tests__/app.test.ts`: rotas, autenticação, CORS e limites do Worker.
- `worker/__tests__/capacity.test.ts`: 3.000 avaliações determinísticas em lote.
- `worker/__tests__/feedbackRepository.test.ts`: persistência e filtros de feedback.
- `worker/__tests__/fakeD1.ts`: banco D1 em memória usado somente pelos testes.
- `scripts/__tests__/token-provisioning.test.mjs`: geração, hash e validação de credenciais.

### Pastas geradas ou privadas

- `dist`: extensão pronta para carregar no Chrome; é recriada pelo build.
- `server-dist`: bundle gerado da API Node.
- `worker-dist`: saída temporária da validação do Worker.
- `node_modules`: dependências instaladas; nunca editar manualmente.
- `.wrangler`: estado local das ferramentas Cloudflare.
- `.aebot-private`: tokens, hashes e identidade da extensão. É ignorada pelo Git e deve ter backup seguro.
- `.git`: histórico interno do repositório.

## 5. Manutenções comuns

### Adicionar ou alterar uma regra

1. Edite `src/data/rulesStore.json`.
2. Atualize a versão da base.
3. Acrescente exemplos reais em `src/data/regressionCases.json`.
4. Rode `npm run rules:audit`, `npm test`, `npm run typecheck` e os builds.
5. Publique o Worker e gere novamente o `dist` de produção.

Não escreva a regra em TypeScript para “ajudar” o motor.

### Adicionar um serviço

Cadastre o serviço e suas regras no `rulesStore.json`, crie regressões próprias e valide a seleção pelo `serviceId`. Nenhum fallback deve apontar para o primeiro serviço.

### Melhorar entendimento de linguagem

- equivalência geral, como abreviação: `languageAliases.json`;
- equivalência de negócio: regra correspondente em `rulesStore.json`;
- comportamento genérico de frase: normalizador, classificador ou recuperador, sempre com teste.

### Alterar a interface

Comece em `App.tsx` e `src/components`; mantenha a decisão fora dos componentes. O visual fica em `styles.css`.

### Trocar o provedor de IA

Implemente `StructuredModelClient`, conecte-o na composição do backend e preserve os testes que impedem alteração de decisão.

### Alterar a API online

Edite `worker/app.ts`, atualize contratos compartilhados se necessário, teste e publique. Mudança de banco exige uma nova migração numerada; não edite uma migração já aplicada.

## 6. Validação antes de publicar

```powershell
npm test
npm run test:capacity
npm run rules:audit
npm run typecheck
npm run build:production
npm run build:server
npm run build:worker
```

Depois do deploy, execute `npm run deployment:check -- https://aebot-api.pedrolucasbotelho.workers.dev` e remova o feedback técnico criado pelo teste.

Antes de entregar, confira também o diff, os imports, o manifesto gerado e a ausência de segredos fora de `.aebot-private`.
