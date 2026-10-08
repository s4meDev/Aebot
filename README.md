# AEBOT

Assistente de Análise para revisão de Ordens de Serviço executadas por equipes de campo.

O AEBOT está migrando para um aplicativo Windows com IA local e funcionamento offline. Ele ajuda o analista a interpretar situações em linguagem natural, aplicar as regras cadastradas e receber orientação curta e fundamentada. A extensão Chrome e a API online continuam no repositório como versões legadas compatíveis.

## Por onde começar

O aplicativo e o instalador estão implementados para testes supervisionados. **A qualidade da IA local ainda não está homologada para distribuição ampla.** Testes de código aprovados não garantem que o modelo interprete corretamente qualquer relato.

O foco do protótipo atual é **Repavimentação Asfalto**, nas duas faixas de área. O código está na versão **2.22.1**, com base **2.15.3**. Corrigi faltas ligadas por “nem” e a interpretação de evidência final presente. A rodada real passou **51/51 casos**, conferindo conclusões e regras. A mediana com IA foi 17,7 segundos e o máximo 78,8 segundos nesta máquina de 8 GB; a velocidade ainda precisa melhorar. O [protótipo portátil](docs/PROTOTIPO-PORTATIL.md) leva EXE, runtime, modelo e catálogo preparado, sem configuração para o analista. Baixe a entrega completa no [pré-lançamento 2.22.1](https://github.com/s4meDev/Aebot/releases/tag/v2.22.1-prototipo) e siga [o guia do Latitude](docs/INSTALAR-NO-LATITUDE.md). O aplicativo não tem assinatura própria e pode ser bloqueado pelo Controle de Aplicativo do Windows. Não está homologado para distribuição ampla. Consulte [medições e limites atuais](docs/DESEMPENHO-IA-LOCAL.md). Os relatórios anteriores permanecem como histórico. `Abrir-AEBOT.cmd` é um atalho de desenvolvimento, não a distribuição.

| Preciso de… | Onde encontrar |
| --- | --- |
| Instalar, abrir e usar o aplicativo | [Guia do desktop e do piloto](docs/DESKTOP-LOCAL.md) |
| Testar o EXE sem instalar ferramentas | [Protótipo portátil](docs/PROTOTIPO-PORTATIL.md) |
| Levar o protótipo e testar no Latitude da empresa | [Passo a passo no Latitude](docs/INSTALAR-NO-LATITUDE.md) |
| Executar o código no VS Code e testar | [Executar e testar](docs/EXECUTAR-E-TESTAR.md) |
| Entender e medir a demora da IA | [Desempenho local](docs/DESEMPENHO-IA-LOCAL.md) |
| Entender pastas, arquivos e fluxo da análise | [Arquitetura](ARQUITETURA.md) |
| Cadastrar ou corrigir regras | [Como editar as regras](docs/COMO-EDITAR-REGRAS.md) |
| Saber o que falta antes de distribuir | [Plano de validação do desktop](docs/PLANO-DE-VALIDACAO-DESKTOP.md) |
| Comparar o planejamento da gestão com o código | [Kanban de implantação](docs/KANBAN.md) |
| Resolver bloqueio do Windows e preparar assinatura | [Assinatura e liberação](docs/ASSINATURA-E-LIBERACAO-WINDOWS.md) |

## Rota atual: desktop offline

Conforme a apresentação à coordenação, cada notebook executa um Qwen local Q4_K_M com llama.cpp. O protótipo atual seleciona **Qwen3-4B-Instruct-2507**, após comparar candidatos; os anteriores foram preservados. A IA interpreta; o motor compartilhado decide. O usuário abre o aplicativo, seleciona o serviço e pergunta, sem cadastrar token ou chave de API. A seleção do modelo não é homologação de qualidade.

Para preparar o aplicativo em Windows x64, com Node 22.12 ou superior:

```powershell
npm.cmd ci
npm.cmd run desktop:assets
npm.cmd run desktop:catalog:prepare -- --service=repavimentacao-asfalto-ate-1m2
npm.cmd run desktop:start
```

O download ocorre na preparação do pacote (~2,5 GB de modelo). A preparação do catálogo roda uma vez pelo mantenedor, sem relatos de OS; não precisa ser repetida pelo analista. Os perfis de memória são preparados separadamente. Depois, o aplicativo funciona offline. Para o teste portátil autorizado, execute `npm.cmd run desktop:prototype` e distribua a pasta completa indicada no resultado. Esse perfil não possui assinatura própria do AEBOT e pode ser recusado pela política do Windows; não desative proteções para executá-lo. Para gerar o instalador empresarial completo:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run desktop:smoke
npm.cmd run desktop:signing:check
npm.cmd run desktop:package
```

O resultado empresarial fica em `desktop-release`. Entregue juntos `AEBOT-<versão>-Setup.exe`, o GGUF selecionado em `assets-lock.json`, `SHA256SUMS.txt` e `LEIA-ME.txt`. O analista mantém os arquivos na mesma pasta e executa o Setup; o modelo é copiado automaticamente. Essa separação evita o limite de 2 GB do instalador e não exige internet. Não distribua somente o EXE. A pasta `win-unpacked` do build empresarial é técnica; apenas a pasta completa produzida por `desktop:prototype` é destinada ao piloto portátil.

O empacotamento agora exige assinatura e confere as DLLs do runtime antes de montar o Setup. Ainda falta configurar o certificado ou serviço aprovado pela TI; o instalador antigo não foi assinado retroativamente. Veja [assinatura e liberação](docs/ASSINATURA-E-LIBERACAO-WINDOWS.md). `npm.cmd` evita o bloqueio de `npm.ps1` sem alterar a Execution Policy; o diagnóstico PowerShell separado também precisa de execução autorizada. Não desative controles da empresa para executar o projeto.

**Atenção aos comandos:** `desktop:start` abre o aplicativo completo; `dev` abre apenas a interface no navegador; `build` gera a extensão Chrome legada, não o instalador Windows.

Nas configurações do aplicativo é possível verificar a IA, reiniciá-la, importar um pacote de regras aprovado e exportar métricas/feedbacks para a gestão. O modelo não recebe suas conversas pela internet. Atualizar as regras não exige redistribuir o modelo.

Consulte [Guia do desktop e piloto](docs/DESKTOP-LOCAL.md) e [decisão de arquitetura](docs/ADR-001-DESKTOP-LOCAL.md). A qualidade semântica e a velocidade precisam ser homologadas no notebook corporativo; o piloto começa com 5 a 10 analistas e pode chegar a 60 após validação.

O [relatório de otimização de 07/10](docs/STATUS-DESKTOP-2026-10-07-OTIMIZACAO.md) registra as correções e medições atuais. O runtime assinado da Unsloth carrega o Qwen sem alterar a segurança do Windows. O protocolo local ficou mais compacto, o consumo de memória foi ajustado e relatos afirmativos não viram consultas por escolha do modelo. Na amostra de três paráfrases, conclusões e regras passaram, mas a primeira resposta levou cerca de 165 segundos. Isso não homologa qualidade ou velocidade. O aplicativo e o Setup ainda dependem de credencial de assinatura para uma nova distribuição. O [primeiro relatório de 07/10](docs/STATUS-DESKTOP-2026-10-07.md) e os relatórios de [01/10](docs/STATUS-DESKTOP-2026-10-01.md), [29/09](docs/STATUS-DESKTOP-2026-09-29.md), [28/09](docs/STATUS-DESKTOP-2026-09-28.md), [25/09](docs/STATUS-DESKTOP-2026-09-25.md) e [22/09](docs/STATUS-DESKTOP-2026-09-22.md) permanecem como histórico.

## O que o sistema faz

- interpreta perguntas e relatos naturais ou informais, com limitações do modelo local ainda em avaliação;
- considera o serviço selecionado e o contexto explícito da conversa;
- recupera regras relacionadas ao caso, dentro do catálogo selecionado;
- resolve conflitos de forma determinística;
- explica a decisão e informa as regras utilizadas;
- oferece orientação fundamentada quando há relação útil, mas ainda faltam fatos para uma conclusão oficial;
- reconhece quando realmente faltam regras ou informações;
- recebe feedback dos analistas sem copiar automaticamente o chat.

As únicas conclusões oficiais são:

- **Conforme**: serviço aprovado e correto;
- **Não Conforme**: serviço aprovado, mas com correção ou problema que deve ser pontuado;
- **Reprovado**: serviço sem execução válida, no local incorreto, sem evidência suficiente ou com falha grave.

Quando a base ajuda, mas ainda não sustenta uma conclusão, o sistema retorna uma **orientação fundamentada** com `decision: null`, próximos passos, regras relacionadas e o que falta confirmar. Ausência real de base continua como **sem decisão**. O AEBOT nunca usa uma decisão padrão para aprovar.

## Como funciona

```text
Pergunta do analista
  -> serviço selecionado
  -> interpretação do texto e do contexto
  -> recuperação das regras cadastradas
  -> avaliação determinística
  -> explicação curta e fundamentada
```

O motor de regras escolhe a decisão. A inteligência artificial é opcional e serve para conectar linguagem informal aos termos cadastrados e organizar a explicação; ela não pode criar regras nem alterar a conclusão calculada.

Quando a IA é necessária, ela relaciona o significado do relato às situações cadastradas, mesmo com palavras diferentes. No desktop, o protocolo compacto pede apenas os mapeamentos úteis e uma orientação curta; não gera listas extensas de evidências não mencionadas. Todas as regras classificatórias atômicas do serviço continuam disponíveis. O backend reconstrói as citações dos trechos numerados, e o motor recebe os mapeamentos em `evaluateFacts`, confere serviço, condições e exceções e combina os fatos quando a base permitir. Não mencionar uma etapa não comprova ausência, e texto canônico não é reavaliado como uma nova pergunta. O contrato por estados de evidência continua no código como referência; não é o perfil padrão do cliente local. Ainda não existe uma ficha independente completa, e a qualidade do modelo continua em validação.

## Capacidades preservadas e perfil online legado

Os itens abaixo descrevem o código preservado e a configuração do perfil online. Não confirmam disponibilidade atual dos serviços publicados nem homologação de provedores. Não são requisitos para executar o desktop offline.

- extensão React + TypeScript + Vite pronta para Chrome;
- backend online implementado para Cloudflare Workers;
- base central compartilhada entre extensão, Worker e servidor Node;
- autenticação individual preparada para 40 analistas;
- teste de capacidade para 3.000 avaliações;
- feedback persistente em Cloudflare D1;
- painel administrativo protegido com uso, atividade, saúde dos modelos, cotas disponíveis e feedback;
- configuração de contingência online Gemini Flash-Lite/Flash e Workers AI GPT-OSS/Qwen3;
- interpretação semântica das regras pertinentes do serviço, inclusive para linguagem informal e respostas curtas de esclarecimento;
- conversa AI-first para dúvidas e casos ambíguos, com resposta direta de até quatro frases e uma única pergunta quando faltar contexto;
- 36 serviços cadastrados no catálogo, incluindo corte, religação, implantação, redes, repavimentação e Substituição de HD com e sem custo;
- 99 regras e orientações na base 2.15.3, incluindo os critérios de Repavimentação Asfalto e a descrição de cada etapa de evidência;
- cadeia de evidências do original, do adicional executado e do adicional posterior tratada de forma explícita;
- ausência de Troca, Adicional Executado ou Adicional Posterior necessário resulta em Não Conforme; impossibilidade de trocar para o serviço correto resulta em Reprovado;
- critérios de desdobro para ramal, reaterro e repavimentação cadastrados; falhas sem conclusão oficial definida recebem orientação prática sem decisão automática.
- Reparo de Ramal compartilha as conclusões de antes, durante e depois do Cavalete, mas não exige chassi/hidrômetro; a recomposição depende do revestimento, e Ramal Terra não exige pavimento.
- Em Reparo de Ramal ou Rede no asfalto, o desdobro de pavimento considera a superintendência: Baixada/Lagos usam Reaterro; Norte/Centro-Sul/Comunidades usam Concreto; Leste usa Repavimentação de Asfalto ou Concreto. Desdobro diferente é corrigido como Não Conforme.
- Em Reaterro e Repavimentação sem aferição da vala, equipe interna gera Não Conforme com Retrabalho e equipe terceirizada gera Reprovação. Se o problema estiver no Adicional Executado, o AEBOT orienta o lançamento correto no Posterior conforme o vínculo da equipe.
- Reparo de Rede compartilha as regras gerais de antes, durante e depois do Ramal; metragem lançada sem comprovação é zerada e pontuada como Não Conforme.
- Quando uma regra depende de contexto ausente, o AEBOT faz uma pergunta objetiva e aproveita a resposta curta do analista na continuação do mesmo caso.

## Carregar a extensão no Chrome (legado)

Pré-requisito para gerar o pacote: Node.js 22.12 ou superior.

```powershell
npm install
npm run build
```

Depois:

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta `dist` deste projeto.
5. Após gerar uma nova versão, clique em **Atualizar** no cartão do AEBOT.

O `npm run build` já gera o pacote empresarial conectado à API oficial e com identidade estável. Na primeira instalação cada analista informa somente seu token; ele permanece salvo ao recarregar ou atualizar a extensão. Apenas desinstalar a extensão ou limpar seus dados exige informar o token novamente.

Para testar deliberadamente Gemini direto ou backend local, use `npm run build:development`. Esse perfil não deve ser distribuído aos analistas.

## Ambiente online (legado; não utilizado pelo desktop)

- API: [aebot-api.pedrolucasbotelho.workers.dev](https://aebot-api.pedrolucasbotelho.workers.dev)
- Painel administrativo: [aebot-api.pedrolucasbotelho.workers.dev/admin](https://aebot-api.pedrolucasbotelho.workers.dev/admin)

O painel usa o token administrativo e mostra análises, analistas ativos, decisões técnicas, latência, tentativas por modelo, tokens quando informados pelo provedor e feedbacks. Ele não armazena o texto das conversas. A cota restante do Gemini continua disponível somente no Google AI Studio; o consumo de Workers AI exibido no AEBOT é uma estimativa quando os tokens são reportados.

O procedimento completo de publicação, geração de credenciais e instalação está em [Implantação para 40 analistas](docs/DEPLOYMENT-40-USERS.md).
O material simplificado que deve acompanhar o piloto está em [Guia rápido para teste dos analistas](docs/GUIA-TESTE-ANALISTAS.md).
As diferenças entre Gemini e Workers AI, as cotas e o roteiro para iniciar o piloto estão em [Operação do piloto e provedores de IA](docs/OPERACAO-PILOTO-E-PROVEDORES.md).

## Desenvolvimento local

Para iniciar somente a interface:

```powershell
npm run dev
```

Para usar a API Node local de contingência:

```powershell
npm run server:setup
npm run server:local
```

Em outro terminal, execute `npm run server:check`. As configurações privadas ficam em `.env.local` e nunca devem ser enviadas ao Git.

## Comandos principais

| Comando | Finalidade |
| --- | --- |
| `npm run desktop:start` | Compila e abre o aplicativo Windows offline |
| `npm run desktop:smoke` | Verifica o aplicativo real com dados sintéticos e perfil separado |
| `npm run desktop:doctor` | Consulta assinaturas e bloqueios do Windows sem iniciar a IA; exige execução autorizada do script PowerShell |
| `npm run desktop:evaluate` | Executa o corpus técnico com o modelo real; não homologa o produto |
| `npm run desktop:signing:check` | Confere se existe configuração de assinatura; não valida o certificado nem assina arquivos |
| `npm run desktop:package` | Gera Setup e arquivos offline para testes supervisionados |
| `npm run desktop:prototype` | Gera pasta portátil completa, sem assinatura própria do AEBOT; não altera o perfil empresarial |
| `npm run desktop:download -- desktop-release/prototipo-<versão>-<data>/win-unpacked` | Confere o protótipo atual e gera ZIP64, partes de download, hashes e montador |
| `npm test` | Executa os testes automatizados regulares |
| `npm run test:capacity` | Executa isoladamente o teste de 3.000 avaliações |
| `npm run typecheck` | Verifica o TypeScript da extensão, Node e Worker |
| `npm run rules:audit` | Audita estrutura, lacunas e conflitos da base |
| `npm run rules:format` | Padroniza a formatação do JSON sem alterar as regras |
| `npm run rules:check` | Audita regras, TypeScript e testes em uma única execução |
| `npm run build` | Gera a extensão empresarial online em `dist` |
| `npm run build:production` | Gera e valida novamente o pacote empresarial |
| `npm run build:development` | Gera o perfil local, somente para desenvolvimento |
| `npm run build:server` | Gera a API Node em `server-dist` |
| `npm run build:worker` | Valida o pacote do Worker sem publicar |
| `npm run worker:deploy` | Publica o backend no Cloudflare |
| `npm run deployment:check -- URL` | Valida a produção de ponta a ponta |
| `npm run tokens:generate -- --count 40` | Gera credenciais individuais dos analistas |
| `npm run admin:token:generate` | Gera a credencial do painel administrativo |

## Onde alterar cada parte

- regras dos serviços: `src/data/rulesStore.json`;
- equivalências gerais de linguagem: `src/data/languageAliases.json`;
- exemplos de regressão: `src/data/regressionCases.json`;
- motor de análise: `src/services`;
- interface compartilhada: `src/components`, `src/styles.css` e `src/workspace.css`;
- API online: `worker`;
- servidor local: `server`;
- scripts de publicação e validação: `scripts`.

O fluxo completo do código e a finalidade de cada arquivo estão documentados em [Arquitetura do AEBOT](ARQUITETURA.md).

## Documentação

- [Arquitetura do AEBOT](ARQUITETURA.md): ordem de execução, responsabilidades e manutenção do código.
- [Projeto e planejamento](PROJETO.md): requisitos do produto e evolução por sprints.
- [Implantação para 40 analistas](docs/DEPLOYMENT-40-USERS.md): publicação, credenciais e instalação.
- [Capacidade para 3.000 OS por dia](docs/CAPACITY-3000-OS.md): volume, limites e critérios de validação.
- [Operação do piloto e provedores de IA](docs/OPERACAO-PILOTO-E-PROVEDORES.md): qualidade dos modelos, cotas, privacidade e início dos testes.
- [Entrada de regras](docs/RULE-INTAKE.md): processo para cadastrar e revisar conhecimento.
- [Como editar as regras](docs/COMO-EDITAR-REGRAS.md): guia prático com exemplos para manutenção.
- [Base de conhecimento das ITs](docs/BASE-DE-CONHECIMENTO-ITS.md): critérios incorporados e limites de decisão.

## Segurança e privacidade

- regras de negócio ficam no JSON, sem duplicação no código;
- chaves de IA permanecem somente no servidor ou na configuração local autorizada;
- tokens armazenados no Worker ficam em formato de hash;
- logs do backend não registram perguntas, histórico ou respostas;
- o feedback armazena somente o texto enviado conscientemente pelo analista;
- arquivos privados ficam em `.aebot-private` ou `.env.local`, ambos fora do Git.

Nunca adicione chaves em variáveis `VITE_*`, pois elas seriam incorporadas ao pacote público da extensão.

## Limitações conhecidas

- o runtime assinado já iniciou e executou o Qwen; faltam certificado do AEBOT e autorização da verificação PowerShell para gerar e validar um novo instalador assinado;
- a IA local ainda apresenta falhas de interpretação e latência alta em alguns casos; faltam o corpus completo revisado e a medição no Latitude corporativo;
- os resultados históricos de 07/10 não homologam a IA. A revisão atual compara modelos reais e amplia o recorte, incluindo presença, negação e equipe. Consulte [resultados de 08/10](docs/STATUS-DESKTOP-2026-10-08.md); latência e qualidade ainda exigem medição no Latitude;
- a instalação em máquina limpa, a assinatura/liberação pela TI e o piloto supervisionado continuam pendentes;
- a maior parte das novas ITs define padrão de execução, não a conclusão oficial; nesses casos o AEBOT orienta e solicita validação sem inventar decisão;
- seis nomes reconstruídos de rótulos cortados aguardam confirmação em uma captura completa;
- serviços e regras novas precisam ser cadastrados e protegidos por testes de regressão;
- no perfil online legado, acessos individuais, cotas e política de dados dos provedores precisam ser revisados antes de uso empresarial; isso não configura o desktop nem transforma cotas gratuitas em ilimitadas.

## Créditos

Projeto idealizado e conduzido por **Pedro Lucas Botelho**, responsável pela visão do produto e pelas diretrizes operacionais do AEBOT.
