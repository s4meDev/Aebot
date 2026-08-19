# AEBOT

Assistente de Análise para revisão de Ordens de Serviço executadas por equipes de campo.

O AEBOT é uma extensão Chrome Manifest V3 exibida no painel lateral do navegador. Ele ajuda o analista a interpretar situações escritas em linguagem natural, consultar as regras cadastradas e chegar a uma orientação curta e fundamentada.

## O que o sistema faz

- entende perguntas e relatos escritos de forma natural ou informal;
- considera o serviço selecionado e o contexto explícito da conversa;
- localiza todas as regras realmente relacionadas ao caso;
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

## Situação atual

- extensão React + TypeScript + Vite pronta para Chrome;
- backend online publicado em Cloudflare Workers;
- base central compartilhada entre extensão, Worker e servidor Node;
- autenticação individual preparada para 40 analistas;
- teste de capacidade para 3.000 avaliações;
- feedback persistente em Cloudflare D1;
- painel administrativo protegido por credencial separada;
- Workers AI, Gemini e Ollama disponíveis como integrações substituíveis;
- 36 serviços cadastrados no catálogo, incluindo corte, religação, implantação, redes, repavimentação e Substituição de HD com e sem custo;
- 61 regras e orientações baseadas nas diretrizes do produto e nas ITs recebidas;
- cadeia de evidências do original, do adicional executado e do adicional posterior tratada de forma explícita;
- ausência de Troca, Adicional Executado ou Adicional Posterior necessário resulta em Não Conforme; impossibilidade de trocar para o serviço correto resulta em Reprovado;
- critérios de desdobro para ramal, reaterro e repavimentação cadastrados; falhas sem conclusão oficial definida recebem orientação prática sem decisão automática.
- Reparo de Ramal compartilha as conclusões de antes, durante e depois do Cavalete, mas não exige chassi/hidrômetro; a recomposição depende do revestimento, e Ramal Terra não exige pavimento.

## Carregar a extensão no Chrome

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

O pacote oficial para os analistas deve ser criado com `npm run build:production`, pois esse comando restringe a extensão à API de produção.

## Ambiente online

- API: [aebot-api.pedrolucasbotelho.workers.dev](https://aebot-api.pedrolucasbotelho.workers.dev)
- Painel de feedback: [aebot-api.pedrolucasbotelho.workers.dev/admin](https://aebot-api.pedrolucasbotelho.workers.dev/admin)

O procedimento completo de publicação, geração de credenciais e instalação está em [Implantação para 40 analistas](docs/DEPLOYMENT-40-USERS.md).
O material simplificado que deve acompanhar o piloto está em [Guia rápido para teste dos analistas](docs/GUIA-TESTE-ANALISTAS.md).

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
| `npm test` | Executa os testes automatizados regulares |
| `npm run test:capacity` | Executa isoladamente o teste de 3.000 avaliações |
| `npm run typecheck` | Verifica o TypeScript da extensão, Node e Worker |
| `npm run rules:audit` | Audita estrutura, lacunas e conflitos da base |
| `npm run rules:format` | Padroniza a formatação do JSON sem alterar as regras |
| `npm run rules:check` | Audita regras, TypeScript e testes em uma única execução |
| `npm run build` | Gera a extensão local em `dist` |
| `npm run build:production` | Gera e valida o pacote oficial da extensão |
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
- interface da extensão: `src/components` e `src/styles.css`;
- API online: `worker`;
- servidor local: `server`;
- scripts de publicação e validação: `scripts`.

O fluxo completo do código e a finalidade de cada arquivo estão documentados em [Arquitetura do AEBOT](ARQUITETURA.md).

## Documentação

- [Arquitetura do AEBOT](ARQUITETURA.md): ordem de execução, responsabilidades e manutenção do código.
- [Projeto e planejamento](PROJETO.md): requisitos do produto e evolução por sprints.
- [Implantação para 40 analistas](docs/DEPLOYMENT-40-USERS.md): publicação, credenciais e instalação.
- [Capacidade para 3.000 OS por dia](docs/CAPACITY-3000-OS.md): volume, limites e critérios de validação.
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

- a maior parte das novas ITs define padrão de execução, não a conclusão oficial; nesses casos o AEBOT orienta e solicita validação sem inventar decisão;
- seis nomes reconstruídos de rótulos cortados aguardam confirmação em uma captura completa;
- os acessos técnicos ainda precisam ser associados aos analistas reais durante o piloto;
- serviços e regras novas precisam ser cadastrados e protegidos por testes de regressão;
- cotas gratuitas de provedores de IA não são consideradas ilimitadas.

## Créditos

Projeto idealizado e conduzido por **Pedro Lucas Botelho**.

Desenvolvido para apoiar uma análise de Ordens de Serviço mais rápida, consistente e fundamentada.
