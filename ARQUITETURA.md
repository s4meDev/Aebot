# Arquitetura do AEBOT

## Rota atual: desktop offline

Atualização de 07/10: `Abrir-AEBOT.cmd` abre o build local pelo executável Electron existente no workspace. É um atalho de desenvolvimento; o instalador empresarial continua exigindo assinatura. O protótipo de Asfalto é descrito em `docs/PROTOTIPO-ASFALTO.md`.

O novo ponto de entrada é `desktop/main.ts`, um processo Electron que inicia o runtime e mantém o motor fora da interface. A interface React existente acessa somente operações tipadas em `src/desktop/contracts.ts` através de `desktop/preload.ts`. Não há servidor central ou autenticação por API no desktop.

Ordem de execução: interface → IPC validado → `AnalysisService` → `LocalModelClient` → Qwen/llama.cpp no loopback → JSON validado pelo `SemanticInterpreter` → `RuleEngine` → explicação curta. Casos já conclusivos usam diretamente o motor. Perguntas pendentes e retificações continuam usando os contratos existentes.

Desde 28/09, o orquestrador entrega `SemanticEvaluationInput` a `RuleEngine.evaluateFacts`: relato original, serviço selecionado e mapeamentos com citações. O motor revalida essa entrada e `RuleRetriever.retrieveMappedRules` avalia somente as regras apontadas e suas combinações previstas na base, sem reconstruir texto para pesquisar todo o catálogo novamente. Exceções e condições obrigatórias são conferidas no relato original, inclusive nas regras agregadoras. O resultado, o ranking e a formatação continuam compartilhados com `evaluatePrompt`.

Na revisão 2.21.0, o cliente local usa o contrato curto `indexed`: trechos numerados, IDs legíveis de regras e intenção codificada, com orientação/pergunta opcionais. O catálogo completo de regras atômicas fica no prefixo de sistema, antes do histórico e do relato, permitindo reaproveitar sua leitura em RAM. A identidade real do serviço permanece no pedido e na validação do motor. Agregadoras não ficam à escolha do modelo. Os protocolos `compact` anterior e por estados de evidência permanecem para referência/testes. A validação reconstitui citações literais e o motor revalida condições e exceções no original. `canonicalPrompt` não decide a análise. Ainda não há ficha independente completa; K09/K10 registram esse avanço parcial no [Kanban](docs/KANBAN.md). Medições e limitações em [desempenho local](docs/DESEMPENHO-IA-LOCAL.md).

Arquivos do desktop, na ordem de responsabilidade:

Atualização 2.22.1: `src/ai/LocalSources.ts` separa itens negados mantendo citações literais e o “nem”. Isso não altera o matching lexical nem cria fatos. A conferência local recebe também título e descrição da regra indicada, além do catálogo completo. `scripts/download-packet.mjs` confere o pacote, gera ZIP64 e partes de 1 GiB, com montagem verificável por SHA-256. Não publica automaticamente, não inclui perfil do analista e não altera proteções. Os testes ficam em `LocalSources.test.ts` e `download-packet.test.mjs`.

- `desktop/main.ts`: janela, validação do remetente IPC, coordenação das análises e diálogos de importação/exportação.
- `desktop/preload.ts`: ponte limitada entre interface isolada e processo principal; não expõe Node nem IPC genérico.
- `src/desktop/contracts.ts`: operações e estado do aplicativo local.
- `desktop/ModelRuntime.ts`: processo llama.cpp oculto, porta aleatória em 127.0.0.1 e credencial temporária. `resourceProfile` ajusta o contexto à RAM física e fixa cache de atenção q8, flash attention e reserva de cache de slots igual a zero. Distingue processo encerrado, autenticação recusada, runtime sem resposta e modelo ainda carregando. Se o pedido de encerramento falhar, preserva a referência e não inicia outro processo. Sinal enviado não equivale a confirmação de saída do Windows.
- `desktop/ModelIntegrity.ts`: confere tamanho e SHA-256 do modelo antes de iniciar a inferência.
- `desktop/LocalModelClient.ts`: requisição local com JSON restrito, timeout e validação; não tem contingência externa.
- `src/ai/LocalInterpretation.ts`: constrói prefixo fixo e pedido variável. No perfil padrão, preserva todas as regras atômicas e orientações do serviço. Confere campos curtos, IDs legíveis, intenção e índices dos trechos; reconstrói citações e delega à validação semântica. Posições numéricas para regras foram descartadas após confusão de etapas na inferência real. Não decide a OS.
- `src/ai/EvidenceInterpretation.ts`: deriva o catálogo dos dados e apresenta título, descrição e conceitos de cada evidência. Solicita estados e trechos ao modelo, recusa campos/grupos desconhecidos e converte ausências válidas para o contrato semântico compartilhado. Outras regras levam condições obrigatórias e exceções. A gramática exige referência para estados relatados e lista vazia para `not_mentioned`; o parser revalida o significado. Não contém etapas ou IDs de um serviço fixados no código.
- `src/ai/LocalMappingVerification.ts`: prioriza conceitos explícitos dos dados quando classificatórias concorrem sobre um fato simples; preserva coordenações e paráfrases sem âncora literal. Se ainda houver várias associações acionáveis, a segunda chamada local confirma ou exclui IDs já indicados, sem criar fatos ou conclusões. Exclusões retiram a narrativa que poderia depender delas. Falha da conferência impede usar a interpretação e preserva a contingência do motor. Acrescenta latência e não substitui revisão operacional.
- `desktop/RuleRelease.ts`: pacote de regras com responsável, vigência, versão e histórico descritivo; reutiliza o schema oficial.
- `desktop/LocalData.ts`: escrita atômica, métricas sem conversas e feedback voluntário local.
- `desktop/PublicCatalogCache.ts`: restaura apenas a leitura preparada do catálogo. Confere índice fixado no bundle, arquivo, modelo, runtime, instrução e perfil; nunca salva slots de análise. Sem recurso compatível, a inferência processa a base atual normalmente.
- O contrato curto preserva a oração em “não há X nem Y” e aceita dois fatos citando o mesmo trecho. Também preserva frases distintas da mesma regra. A conferência por citação valida situação e estado com campos nomeados; confirmar uma frase não confirma automaticamente as outras. Dupla negação é normalizada antes de aceitar ausência.
- `desktop/prepareCatalog.ts` e `scripts/prepare-public-catalog.mjs`: preparação isolada pelo mantenedor, recebendo só IDs do catálogo. Usa template/tokenização oficiais, gramática vazia e dois perfis de memória; publica o índice somente depois de concluir. Preserva arquivos anteriores e não recebe conversas.
- `desktop/PublicCatalogPreparation.ts`: valida os contadores da preparação. O runtime pode contar um encerramento mesmo com `n_predict=0`, mas nenhum texto é aceito; o arquivo precisa ter exatamente os tokens da entrada pública. Os testes correspondentes cobrem geração indevida, truncamento e estado incompleto ou com token extra.
- `desktop/SmokeSemanticCheck.ts`: confere conclusão, regras e contadores públicos do teste com IA real. Não exige tentativas privadas no renderer nem amplia o IPC. `desktop/__tests__/SmokeSemanticCheck.test.ts` recusa falso acerto, ausência de inferência e erro técnico. `--aebot-smoke-semantic` testa desenvolvimento; só o EXE final com `--aebot-package-check` testa a distribuição.
- `scripts/public-catalog-definition.mjs`: incorpora o hash do índice no build desktop/avaliador. Impede aceitar um índice externo adulterado junto do binário de cache.
- `scripts/package-public-catalog.mjs`: hook anterior à assinatura; copia somente arquivos íntegros do índice selecionado. Recusa preparação alterada depois do build. Não altera EXEs/DLLs nem lê perfil do analista.
- `desktop/__tests__/PublicCatalogCache.test.ts` e `scripts/__tests__/public-catalog-package.test.mjs`: incompatibilidade, adulteração, links, caminhos, reinício e restauração sem persistir chats. Testes simulados, não medições de desempenho.
- `src/components/DesktopSettings.tsx`: situação da IA, importação e exportação, sem pedir chave ou endereço.
- `desktop/evaluate.ts`: compara o modelo real ao corpus técnico; registra início antes de carregar o runtime, progresso e falhas sem copiar exceções brutas. O cliente de diagnóstico preserva o protocolo do aplicativo; o relatório registra protocolo e configuração real do runtime. `--inspect-facts` mostra somente interpretações do corpus sintético; não existe na telemetria do aplicativo. Mantém homologação operacional como pendente.
- `src/data/asphaltPilotCases.json`: 49 casos sintéticos de Asfalto; 14 reservados ao fluxo conversacional/semântico. Incluem negação de falta, consulta sem ocorrência e ausências coordenadas. Negativos também conferem associações permitidas; falha técnica não conta como interpretação correta de `null`. O comando `desktop:evaluate -- --corpus=asfalto` preserva o serviço de cada caso; `--prepared` usa o catálogo preparado como no aplicativo.
- `src/services/__tests__/AsphaltPrototype.test.ts`: regras nas duas áreas, negações, combinações, prioridade, resposta curta, contexto obrigatório e isolamento dos outros serviços.
- `desktop/EvaluationSummary.ts`: valida o progresso e resume divergências, consumo informado e latência separada por casos com e sem chamadas à IA. Uma rodada concluída pode ter divergências; uma falha sem casos não é aprovação.
- As avaliações sintéticas são salvas desde o início e após cada caso em `desktop-release/evaluations/`; `local-evaluation.json` contém a rodada mais recente, inclusive quando falhou ao iniciar. São artefatos de teste, não conversas dos analistas. Uma interrupção abrupta pode deixar estado `starting` ou `running`, sempre incompleto.
- `desktop/__tests__/ModelRuntime.test.ts`: limites do orçamento experimental de raciocínio e perfil de memória para 8/16 GB.
- `desktop/__tests__/ModelRuntimeLifecycle.test.ts`: inicialização, cancelamento, autenticação e falhas do processo simuladas; não mede inferência.
- `desktop/__tests__/EvaluationSummary.test.ts`: cálculos de métricas e coerência do progresso.
- `desktop/__tests__/EvaluationLifecycle.test.ts`: falha antes da inferência, preservação de resultados parciais e conclusão com divergências, sem iniciar executáveis reais.
- `src/ai/__tests__/LocalInterpretation.test.ts`: contrato de referência por evidências, alternativa por IDs e integração com o motor.
- `src/ai/__tests__/CompactLocalInterpretation.test.ts`: protocolo compacto, catálogo completo de classificatórias, campos desconhecidos, fontes, polaridade e contexto obrigatório, com clientes simulados. Não homologa o Qwen.
- `src/ai/__tests__/IndexedLocalInterpretation.test.ts`: contrato curto padrão, prefixo estável, identidade do serviço, IDs/trechos inválidos e proteção de evidência presente. Testes de contrato não medem o modelo real.
- `src/services/__tests__/QueryIntentClassifier.test.ts`: relato afirmativo, hipótese, consulta e uso reflexivo de “se”.
- `src/ai/__tests__/LocalMappingVerification.test.ts`: filtragem, narrativa incompatível, campos desconhecidos e falha segura da segunda chamada, com cliente simulado.
- `scripts/build-desktop.mjs`: compila renderer, processo principal e preload separadamente.
- `scripts/prepare-desktop-assets.mjs`: baixa runtime/modelo das fontes fixadas no lock, confere SHA-256 e extrai o ZIP plano com o tar do Windows. Usa pastas por versão e preserva a anterior. O runtime atual é a distribuição assinada da Unsloth, fork do llama.cpp.
- `scripts/verify-desktop-assets.mjs`: bloqueia o instalador se faltarem arquivos, hashes ou licenças.
- `scripts/check-signing-configuration.mjs`: preflight do instalador, antes de copiar arquivos; exige configuração sem exibir credenciais. Não comprova validade do certificado. O contrato TypeScript está em `check-signing-configuration.d.mts`, e os testes em `desktop/__tests__/SigningConfiguration.test.ts`.
- `scripts/check-desktop-security.mjs`: comando `desktop:doctor`, diagnóstico somente de leitura; retorna pendência quando faltam assinaturas ou não é possível consultar.
- `scripts/runtime-security.mjs`: valida pasta versionada, entradas do ZIP, inventário exato e contrato do diagnóstico. Exige EXEs/DLLs com assinatura válida na distribuição; não confunde eventos históricos com bloqueio atual.
- `scripts/inspect-runtime-security.ps1`: consulta Authenticode, estado do Smart App Control e eventos 3077 filtrados. Respeita a Execution Policy, não modifica o Windows e não executa o runtime.
- `scripts/verify-signed-runtime.mjs`: hook após assinatura; verifica a cópia empacotada, preserva hashes de origem em `signature-provenance.json` e registra hashes dos binários assinados. Não altera os arquivos originais baixados.
- `scripts/__tests__/runtime-security.test.mjs` e `signed-runtime-hook.test.mjs`: contratos de diagnóstico, bloqueio de distribuição e proteção do inventário; certificados e gravações são simulados.
- `scripts/finalize-desktop-package.mjs`: coloca a cópia do modelo ao lado do Setup, gera hashes e instruções de distribuição.
- `desktop/installer.nsh`: exige o modelo ao lado do Setup e o copia para a instalação, sem download.
- `desktop-resources/assets-lock.json`: versão, publicador, pasta e licença do runtime, mais identidade e hashes dos artefatos. Somente a pasta selecionada entra no pacote; pesos e binários ficam fora do Git.
- `electron-builder.json`: instalador Windows x64 com runtime e licenças; exige assinatura, inclui DLLs e chama a conferência após assinatura. Credencial real ainda depende da TI. Modelo auxiliar externo ao Setup, sem exigir Node no notebook do analista.

Os arquivos de regras instalados em `%APPDATA%/AEBOT` prevalecem sobre a base embarcada apenas se válidos e atuais. Uma importação substitui o motor e seu cache juntos. A interface recarrega o catálogo e limpa o caso para não misturar versões. O pacote anterior fica disponível em `.previous` para recuperação pela TI.

O restante deste mapa descreve o núcleo compartilhado e os perfis online anteriores, preservados durante a migração. Eles não são chamados pelo aplicativo offline. Veja `docs/ADR-001-DESKTOP-LOCAL.md` para os limites da primeira entrega.

## Atualização do protótipo em 08/10/2026

- `src/workspace.css`: layout compartilhado, com contexto à esquerda em janela larga e acima do chat em janela estreita. Sobrescreve o tema legado sem fontes remotas ou efeitos pesados.
- `src/components/ChatPanel.tsx`: invalida respostas atrasadas quando serviço/base mudam e mostra tempo real de espera, sem progresso inventado. A invalidação não cancela a inferência já em andamento.
- `desktop-resources/model-candidates.json`: identidades fixas de modelos experimentais; não muda a seleção do aplicativo.
- `scripts/prepare-model-candidate.mjs`: baixa candidato para arquivo parcial e só aceita após conferir tamanho e SHA-256; preserva os pesos anteriores.
- `desktop/evaluate.ts`: `--candidate=qwen35` ou `--candidate=qwen35lite` muda somente a rodada sintética. Modelo, hash e perfil ficam no relatório; não é uma opção do analista.
- `scripts/diagnose-model-start.mjs`: mede inicialização de candidato, sem perguntas ou conversas. Não faz parte da telemetria de uso.
- `electron-builder.prototype.json` e `scripts/package-prototype.mjs`: perfil portátil explícito, sem assinatura própria do AEBOT. Cria pasta nova, copia o modelo e verifica os hashes do runtime e dos arquivos finais. Preserva os bytes do runtime de IA e não enfraquece o build empresarial. O builder ainda insere integridade ASAR no EXE Electron; esse arquivo final não é anunciado como assinado nem idêntico ao host original.
- `scripts/__tests__/prototype-package.test.mjs` e `desktop/__tests__/ModelCandidate.test.ts`: contratos de separação dos perfis e identidade do modelo; não comprovam assinatura ou aceite em máquina corporativa.

O runtime usa `--no-warmup`: evita uma inicialização sintética prolongada, mas a primeira inferência continua fria e precisa entrar na medição de latência. Isso não garante resposta mais rápida. O cliente e os relatórios identificam o modelo selecionado pelo lock, sem rótulo fixo no painel.

O build gera `desktop-dist/model-install.nsh` a partir do lock; `desktop/installer.nsh` não mantém outro nome de GGUF. Preparação e verificação usam licença, origem fixa e hash do modelo selecionado, preservando a licença anterior. O modo `--aebot-package-check` do EXE empacotado usa perfil temporário, carga real do runtime e o mesmo smoke sintético; o relatório registra início/conclusão/falha e não persiste conversa.

No desktop, uma pergunta de contexto já cadastrada e vinculada a um cenário lexical forte sai diretamente do motor, sem esperar a IA ou permitir que ela invente equipe/posição. Paráfrases e relatos realmente ambíguos continuam passando pelo modelo. A polaridade do trecho original é revalidada antes de aceitar ocorrência ou ausência.

## Estratégia de IA online (legado)

O motor calcula uma avaliação técnica inicial, mas resultados informativos, orientativos ou ambíguos passam pela camada conversacional AI-first. O backend tenta `gemini-3.5-flash-lite`, `gemini-3.5-flash`, `@cf/openai/gpt-oss-20b` e por fim `@cf/qwen/qwen3-30b-a3b-fp8`. Cada próximo modelo só é chamado diante de falha técnica, limite ou resposta fora do contrato. O catálogo do serviço e o histórico recente são apresentados ao modelo, que devolve simultaneamente os mapeamentos permitidos e uma resposta curta. O backend recalcula e valida a conclusão antes de liberar esse texto.

Informações pendentes são transportadas em `pendingInformation`; o backend não depende de reconhecer frases que ele mesmo escreveu. Assim, respostas curtas como “interna”, “terceirizada” ou o nome de uma superintendência continuam o caso correto sem transformar a pergunta pendente em fato da OS.

Essa ordem é configurável no Worker por `AEBOT_AI_PROVIDER_ORDER`. O padrão configurado é `gemini,workers-ai`. Somente esse perfil online dispensa um modelo na máquina; o desktop descrito acima depende do Qwen local.

Os provedores não são equivalentes em qualidade. O Gemini é mantido como principal por compreender melhor o português informal observado no piloto; o `gpt-oss-20b` é uma contingência online de raciocínio, não uma promessa de resposta idêntica. Respostas inválidas tentam o próximo modelo. Se toda a cadeia falhar, uma orientação ou explicação já fundamentada pelo motor é preservada; somente uma ausência real de correspondência vira `semantic_unavailable`.

Este arquivo é o mapa de manutenção do projeto. A ordem abaixo acompanha o caminho percorrido por uma pergunta, da extensão até a resposta e o feedback.

## 1. Visão geral

Além do desktop acima, o AEBOT preserva três partes executáveis legadas:

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
- `src/services/SemanticInterpreter.ts` permite que o modelo associe linguagem livre somente a IDs cadastrados; a expressão técnica é escolhida pelo backend.
- `src/services/SemanticPolarity.ts` impede confundir ausência, evidência presente e formato incorreto.
- `src/services/ServiceParameterization.ts` consulta Troca, Adicional Executado e Adicional Posterior diretamente das relações cadastradas.

### 2.5 Recuperação e decisão

- `src/services/RuleRetriever.ts` encontra todas as regras aplicáveis, registra os motivos do match e trata condições orientadas pelos dados.
- `src/services/GroundedAdvisory.ts` transforma relações parciais confiáveis em orientação prática, sem criar conclusão oficial.
- `src/services/SemanticRuleRetriever.ts` acrescenta candidatos semânticos permitidos, sem criar regra nova.
- `src/services/ConflictResolver.ts` mantém o ranking anterior por padrão; com `decisionPolicy: most_severe_applicable`, a conclusão mais grave prevalece entre regras já aplicáveis. Não usa regras meramente relacionadas para decidir.
- `src/services/RuleRetriever.ts` confere também `mandatoryConditionGroups`: todos os grupos precisam de uma alternativa presente no relato original, inclusive quando a regra veio do modelo. Isso impede inventar equipe ou posição do adicional para satisfazer uma regra.
- `src/services/RuleEngine.ts` recebe texto em `evaluatePrompt` ou fatos rastreáveis em `evaluateFacts`; compartilha a avaliação final e devolve decisão, evidências, conflitos, confiança e necessidade de validação humana.
- `src/services/ResponseFormatter.ts` gera a resposta curta de contingência.
- `src/services/AnalysisService.ts` executa o mesmo fluxo na extensão, no servidor Node e no Worker.

Se nenhuma regra classificatória realmente aplicável for encontrada, `decision` é `null`. Quando existem regras ou conceitos próximos, o resultado `advisory` informa o direcionamento, a base consultada e o que falta confirmar. Ausência real de relação continua como `insufficient`. O sistema não usa decisão padrão para aprovar.

### 2.6 Uso opcional de IA

- `src/ai/StructuredModelClient.ts` define o contrato que qualquer modelo deve cumprir.
- `src/ai/WorkersAiModelClient.ts` integra o modelo disponível no Cloudflare Worker.
- `src/ai/WorkersAiModelClient.ts` integra a contingência online do Cloudflare Workers AI.
- `src/ai/GeminiProvider.ts` mantém o nome histórico, mas hoje coordena o motor e qualquer cliente estruturado configurado.
- `src/ai/PromptBuilder.ts` entrega ao modelo a avaliação já calculada e proíbe alteração da decisão.

O modelo compreende linguagem informal, referências ao histórico e frases incompletas, responde em até quatro frases e faz no máximo uma pergunta por vez. A decisão recebida do motor é imutável; se o texto do modelo contrariá-la, ele é descartado e entra o formatador curto de contingência.

### 2.7 Resposta e feedback

- A resposta volta pelo backend e é exibida por `ChatPanel.tsx`.
- O feedback segue para `POST /v1/feedback` sem copiar automaticamente a conversa.
- `worker/feedbackRepository.ts` grava o registro no D1.
- `worker/adminPage.ts` fornece a página protegida para métricas operacionais e feedbacks.
- `worker/metricsRepository.ts` agrega uso por dia, analista, modelo e estado técnico sem persistir o conteúdo do chat.

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

- `rulesStore.json`: serviços e regras de negócio; é a fonte de verdade funcional. Regras idênticas entre variações usam `applicableServiceIds`, evitando cópias que poderiam divergir.
- `languageAliases.json`: abreviações e equivalências gerais de linguagem.
- `regressionCases.json`: frases reais que protegem o comportamento esperado da base.
- `schemas/rulesStore.schema.json`: autocomplete e validação visual dos campos no VS Code.
- `.vscode/settings.json`: associa o schema ao arquivo da base para reduzir erros de digitação.

#### `src/services`

- `AnalysisService.ts`: fachada compartilhada que executa uma análise completa.
- `ConversationContextResolver.ts`: continuação, retificação e novo caso.
- `TextNormalizer.ts`: normalização e tokens inteiros.
- `QueryIntentClassifier.ts`: intenção e força da afirmação.
- `RuleRetriever.ts`: recuperação, score e motivos de correspondência.
- `GroundedAdvisory.ts`: orientação segura para correspondências parciais.
- `SemanticRuleRetriever.ts`: combinação segura de candidatos semânticos.
- `SemanticInterpreter.ts`: valida a interpretação limitada produzida pela IA.
- `SemanticPolarity.ts`: valida a polaridade linguística antes de aplicar a regra.
- `ConflictResolver.ts`: escolhe a regra principal sem descartar as demais.
- `RuleEngine.ts`: coordena o resultado determinístico tipado.
- `ResponseFormatter.ts`: formata respostas sem depender de IA.
- `RuleStoreValidator.ts`: valida a estrutura da base em tempo de execução, inclusive os serviços compartilhados por uma regra.
- `ServiceCatalogService.ts`: expõe catálogo e versão da base.
- `ServiceParameterization.ts`: transforma as relações entre serviços em respostas informativas, sem calcular decisão.
- `KnowledgeService.ts`: consulta detalhes e regras de um serviço.
- `__tests__`: testes unitários e corpus de regressão do motor.

#### `src/ai`

- `BackendClient.ts`: cliente HTTP da API.
- `BackendProvider.ts`: provider usado pela extensão e política de fallback.
- `GeminiProvider.ts`: orquestra motor, interpretação e humanização.
- `PromptBuilder.ts`: prompts restritos ao resultado e às regras recuperadas.
- `StructuredModelClient.ts`: interface comum para modelos.
- `WorkersAiModelClient.ts`: adaptador do Workers AI.
- `WorkersAiModelClient.ts`: adaptador do modelo online executado no Cloudflare.
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
- `migrations/0001_feedback.sql`: criação inicial da tabela de feedback.
- `migrations/0002_operational_metrics.sql`: métricas agregadas de atividade e tentativas de IA.
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
- A saúde dos provedores online é verificada pelo backend e pelos diagnósticos de implantação.
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
- `OPERACAO-PILOTO-E-PROVEDORES.md`: ordem dos modelos, cotas, privacidade e roteiro operacional.
- `RULE-INTAKE.md`: processo para cadastrar e revisar regras.
- `COMO-EDITAR-REGRAS.md`: manutenção prática da base com exemplos seguros.
- `BASE-DE-CONHECIMENTO-ITS.md`: critérios extraídos das ITs e seus limites classificatórios.

### Arquivos de teste

Os testes ficam perto da parte que protegem:

- `src/services/__tests__/ConversationContextResolver.test.ts`: novo caso, continuação e correção de fatos.
- `src/services/__tests__/RegressionCorpus.test.ts`: todas as frases cadastradas no corpus de regressão.
- `src/services/__tests__/RuleEngine.test.ts`: decisões, intenções, conflitos, múltiplas regras e serviços.
- `src/services/__tests__/StructuredEvaluation.test.ts`: entrada direta dos fatos, citações, isolamento do serviço, exceções, condições obrigatórias e combinação segura de regras.
- `src/services/__tests__/RuleStoreValidator.test.ts`: schema e integridade da base.
- `src/services/__tests__/SemanticInterpreter.test.ts`: limites da interpretação feita pelo modelo.
- `src/services/__tests__/SemanticRuleRetriever.test.ts`: união segura de matches textuais e semânticos.
- `src/services/__tests__/ServiceCatalogService.test.ts`: catálogo e versão central.
- `src/services/__tests__/ServiceParameterization.test.ts`: relações, desdobros e proteção contra correspondência parcial.
- `src/ai/__tests__/BackendClient.test.ts`: requisições, respostas e falhas HTTP.
- `src/ai/__tests__/BackendProvider.test.ts`: backend preferencial e regras do fallback.
- `src/ai/__tests__/GeminiProvider.test.ts`: decisão imutável, histórico e humanização.
- `src/ai/__tests__/WorkersAiModelClient.test.ts`: contrato do modelo de contingência online.
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
4. Rode `npm run rules:check` e os builds.
5. Publique o Worker e gere novamente o `dist` de produção.

Não escreva a regra em TypeScript para “ajudar” o motor.

### Adicionar um serviço

Cadastre o serviço uma única vez no `rulesStore.json`. Se as regras ainda não foram fornecidas, use `analysisStatus: "rules_pending"`; o serviço já poderá ser referenciado como original ou parametrizado, mas não produzirá decisão. Quando as regras forem cadastradas, altere o status para `active`, crie regressões próprias e valide a seleção pelo `serviceId`. Nenhum fallback deve apontar para o primeiro serviço.

As opções de outro serviço devem referenciar o ID já existente em `parameterization.serviceExchange`, `executedAdditional` ou `subsequentAdditional`. Não copie o cadastro do serviço para cada lista. Se uma captura cortar o nome, registre `catalogNameStatus: "needs_confirmation"` e preserve o trecho visível em `sourceLabel` até receber o rótulo completo.

### Melhorar entendimento de linguagem

- equivalência geral, como abreviação: `languageAliases.json`;
- equivalência de negócio: regra correspondente em `rulesStore.json`;
- comportamento genérico de frase: normalizador, classificador ou recuperador, sempre com teste.

### Alterar a interface

Comece em `App.tsx` e `src/components`; mantenha a decisão fora dos componentes. O tema legado fica em `styles.css`, e o layout compartilhado atual em `src/workspace.css`.

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

Depois do deploy, execute `npm run deployment:check -- https://aebot-api.pedrolucasbotelho.workers.dev`. O diagnóstico cria, consulta e remove automaticamente seu próprio feedback técnico.

Antes de entregar, confira também o diff, os imports, o manifesto gerado e a ausência de segredos fora de `.aebot-private`.
