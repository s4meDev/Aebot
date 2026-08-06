# Implantação do AEBOT para 40 analistas

## Estado do ambiente

- Worker publicado: `https://aebot-api.pedrolucasbotelho.workers.dev`
- Painel de feedback: `https://aebot-api.pedrolucasbotelho.workers.dev/admin`
- D1, migração, Workers AI, limites, 40 credenciais e identidade estável: configurados.
- Pacote empresarial atual: pasta `dist`.

## Arquitetura escolhida

O destino principal do MVP é uma API em Cloudflare Workers. Ela fica online sem depender de notebook ligado, executa a mesma base e o mesmo motor determinístico da extensão e pode usar Workers AI somente para traduzir linguagem livre em conceitos já cadastrados. O backend Node continua disponível para desenvolvimento e contingência local.

```text
Extensão MV3 (40 instalações)
  -> HTTPS + token individual
Cloudflare Worker
  -> AnalysisService compartilhado
  -> RuleEngine + rulesStore.json
  -> Workers AI opcional
  -> Gemini opcional como contingência
  -> D1 para feedback escrito pelos analistas
```

A decisão oficial nunca é delegada ao modelo. Perguntas resolvidas pelo motor não consomem IA. Se a IA estiver sem cota, o AEBOT continua aplicando regras determinísticas e informa quando uma frase livre não pôde ser interpretada com segurança.

## Pré-requisitos de produção

- conta Cloudflare com Workers AI habilitado;
- Node.js 22.12 ou superior na máquina que gera os pacotes;
- 40 identificadores operacionais, sem nomes completos ou dados pessoais desnecessários;
- chave pública da extensão ou publicação pela Chrome Web Store para manter o mesmo ID;
- decisão da empresa sobre permissão para enviar dúvidas ao Workers AI e, opcionalmente, ao Gemini.

## 1. Gerar acessos individuais

Use um ID por analista. Os arquivos são criados em `.aebot-private/`, ignorada pelo Git:

```powershell
npm run tokens:generate -- --count 40
```

O comando cria:

- `analyst-tokens-*.json`: valores que serão distribuídos individualmente;
- `worker-token-hashes-*.json`: hashes SHA-256 a cadastrar no Worker.

O Worker nunca recebe a lista de tokens legíveis. Um token permanece válido após reiniciar o computador, atualizar a extensão ou publicar uma nova versão do Worker. Ele deixa de funcionar quando for removido do secret, quando o usuário limpar os dados/desinstalar a extensão ou quando for rotacionado.

## 2. Garantir um ID estável da extensão

Para aceitar somente a extensão oficial no CORS, as 40 instalações precisam ter o mesmo ID. A identidade interna pode ser criada uma única vez com:

```powershell
npm run extension:identity:generate
```

O comando não substitui uma identidade existente. A chave privada, a chave pública e o ID ficam em `.aebot-private/`, fora do Git. Transfira essa pasta para um cofre corporativo seguro antes da distribuição definitiva. Uma publicação futura pela Chrome Web Store deve preservar a identidade escolhida ou exigirá atualizar a origem autorizada.

O build empresarial deve exigir a identidade estável:

```powershell
$env:AEBOT_PRODUCTION_API_URL='https://aebot-api.pedrolucasbotelho.workers.dev'
$env:AEBOT_EXTENSION_PUBLIC_KEY=(Get-Content -Raw .aebot-private\extension-public-key.txt).Trim()
$env:AEBOT_REQUIRE_STABLE_EXTENSION_ID='true'
npm run build:production
```

Depois de carregar `dist` em um Chrome de teste, copie o ID exibido em `chrome://extensions`. Essa será a origem `chrome-extension://ID` liberada no Worker.

## 3. Criar o banco de feedback

Autentique o Wrangler uma vez:

```powershell
npx wrangler login
```

Crie o banco D1:

```powershell
npm run feedback:db:create
```

O comando informa um `database_id`. Substitua o UUID zerado de `d1_databases` em `wrangler.jsonc` por esse valor e aplique a migração:

```powershell
npm run feedback:db:migrate
```

Gere também um acesso administrativo separado:

```powershell
npm run admin:token:generate
```

O comando da próxima etapa envia somente o hash. Guarde `admin-token-*.txt` em cofre privado; ele será usado para abrir a página administrativa.

## 4. Configurar e publicar o Worker

Com os arquivos privados gerados, cadastre os hashes e a origem oficial sem exibir valores:

```powershell
npm run cloudflare:secrets:configure
```

Depois publique e valide:

```powershell
npm run worker:deploy
npm run deployment:check -- https://aebot-api.pedrolucasbotelho.workers.dev
```

O `wrangler.jsonc` já configura Workers AI, limite de 240 requisições por minuto por analista, limite menor para acessos não autenticados e corpo máximo de 32 KiB.

Gemini é opcional. Se a política de dados permitir e for necessário como contingência:

```powershell
npx wrangler secret put GEMINI_API_KEY
```

A chave fica em secret criptografado da Cloudflare, nunca no pacote da extensão. Os limites do Gemini pertencem ao projeto da API, não a cada token do AEBOT.

## 5. Gerar e instalar a extensão

Repita o build empresarial com a URL final do Worker e a chave pública. O script deixa no manifest somente a origem HTTPS da API e remove o acesso direto ao Gemini e ao localhost.

Distribua a pasta `dist` pelo canal interno aprovado. Em cada perfil Chrome:

1. carregue a extensão oficial;
2. abra Configurações do AEBOT;
3. informe somente o token daquele analista;
4. use **Testar acesso completo**;
5. confirme catálogo, versão da base e provider online.

O botão **Feedback** fica no cabeçalho do chat. Ele envia somente o texto digitado pelo analista, categoria, serviço, versão e identidade operacional. Pergunta, resposta e histórico do chat não são anexados automaticamente.

Para ler os registros, abra `https://aebot-api.pedrolucasbotelho.workers.dev/admin` e informe o token administrativo. Ele fica apenas na aba atual. A tela permite filtrar, carregar registros antigos e exportar os itens exibidos em CSV. Os mesmos dados também podem ser consultados diretamente no painel D1 da Cloudflare.

## 6. Teste piloto antes dos 40 usuários

Faça um piloto de um dia com 3 a 5 analistas e verifique:

- taxa de respostas determinísticas versus interpretações por IA;
- latência p50/p95 e erros 429/5xx no painel Cloudflare;
- frases reais que retornaram `semantic_unavailable` ou `no_matching_rule`;
- regras ou equivalências que devem ser cadastradas;
- se nenhuma pergunta, resposta ou token apareceu nos logs.
- envio, leitura e exportação de feedback com tokens de teste.

Só depois distribua aos 40. Cota gratuita de IA não é sinônimo de uso ilimitado; a segurança operacional vem do motor determinístico e da degradação controlada.

## Atualização e revogação

- Atualização com o mesmo ID preserva o token salvo no perfil do Chrome.
- Desinstalar a extensão ou apagar seus dados exige informar o token novamente.
- Para revogar uma pessoa, gere um novo JSON de hashes sem aquele acesso e atualize apenas `AEBOT_TOKEN_HASHES`.
- Para trocar a base, valide, publique o Worker e depois gere a extensão com a mesma versão embarcada, preservando o fallback seguro.
- Guarde os arquivos privados em cofre corporativo; não use pasta compartilhada, e-mail ou repositório.

## Fontes oficiais

- [Limites do Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/)
- [Preços e cota gratuita do Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Secrets no Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Binding de rate limit](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Chave e ID estável de extensões Chrome](https://developer.chrome.com/docs/extensions/reference/manifest/key)
- [Limites do Gemini](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Preços e limites gratuitos do D1](https://developers.cloudflare.com/d1/platform/pricing/)
- [Migrações D1](https://developers.cloudflare.com/d1/reference/migrations/)
