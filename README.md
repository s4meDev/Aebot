# AEBOT

Extensão Chrome Manifest V3 para apoiar analistas na revisão de serviços de campo. A decisão é calculada pelo motor de regras; a IA apenas interpreta linguagem livre e torna a explicação mais natural.

## O que existe hoje

- Side panel em React, TypeScript e Vite com interface dark.
- Motor determinístico orientado por `src/data/rulesStore.json`.
- Normalização de linguagem informal, sinônimos cadastrados, intenção, contexto, ranking e conflitos.
- Resultados oficiais somente `Conforme`, `Não Conforme` e `Reprovado`; sem regra suficiente retorna decisão nula.
- Gemini opcional e aterrado às regras, sem autorização para trocar a decisão.
- Backend Node opcional que centraliza a chave, a base e o processamento para vários analistas.
- Fallback local: se o backend estiver indisponível, a extensão informa isso e usa o motor embarcado.
- Corpus de regressão e validação runtime da base.

## Rodar como extensão local

Pré-requisito: Node.js 22.12 ou superior.

1. Execute `npm install`.
2. Execute `npm run build`.
3. Abra `chrome://extensions` e ative o modo desenvolvedor.
4. Clique em “Carregar sem compactação” e selecione a pasta `dist`.
5. Após cada novo build, clique em “Atualizar” no cartão da extensão.

Sem backend, a chave opcional do Gemini pode ser informada nas configurações da extensão. Ela fica somente no perfil local do Chrome e nunca deve ser adicionada ao repositório ou a uma variável `VITE_*`.

## Rodar o backend local

1. Execute `npm run server:setup`. Isso cria `.env.local` sem sobrescrever um arquivo existente.
2. Abra `.env.local` e preencha `GEMINI_API_KEY` se desejar interpretação semântica central. Não envie nem versione essa chave.
3. Execute `npm run server:local`. Esse comando valida, compila e inicia o backend.
4. Em outro terminal, execute `npm run server:check` para conferir servidor, base e Gemini.
5. Nas configurações da extensão, informe `http://127.0.0.1:8787` como URL do backend.
6. Clique em `Testar conexão`. A extensão informa separadamente se o servidor está ativo e se o Gemini central foi configurado.

O endpoint público `GET /health` informa se o servidor está ativo. `GET /v1/services` lista os serviços e `POST /v1/analyze` executa a análise.

O indicador no chat usa o estado real do servidor: `Backend + IA`, `Backend + IA local`, `Backend sem IA` ou `Local • backend off`. Se o servidor estiver sem Gemini, mas este Chrome tiver uma chave local, a interpretação semântica local continua disponível. Se o backend cair, a resposta informa o fallback e o motor embarcado continua funcionando.

Quando o Gemini está ativo, a pergunta do analista, até seis mensagens recentes e as regras relacionadas ao serviço são transmitidas ao Google para interpretação e humanização. A decisão oficial continua sendo calculada localmente pelo motor determinístico; arquivos do computador não são enviados.

Por padrão, o backend chama o Gemini somente quando o matching local é insuficiente e precisa interpretar linguagem livre. Isso reduz latência e consumo de cota. Defina `AEBOT_HUMANIZE_DETERMINISTIC=true` apenas se também quiser que respostas já resolvidas pelo motor sejam reescritas pelo Gemini.

Se o modelo principal atingir o limite temporário de uso, o backend tenta uma vez o modelo reserva configurado em `GEMINI_FALLBACK_MODEL`. Ambos apenas interpretam a frase usando o catálogo enviado; a decisão continua sendo calculada pelo mesmo motor de regras.

### Produção

Em produção, o servidor exige:

- `NODE_ENV=production`;
- `AEBOT_ALLOWED_ORIGINS` com o endereço exato da extensão (`chrome-extension://ID`);
- `AEBOT_API_TOKEN` com um token forte;
- `AEBOT_TRUST_PROXY=true` somente quando a hospedagem possuir proxy reverso confiável;
- `GEMINI_API_KEY` configurada somente no servidor;
- HTTPS por proxy ou plataforma de hospedagem.

Copie `.env.example` apenas como referência; o projeto não carrega esse arquivo automaticamente. Nunca versione um `.env` real. O domínio HTTPS definitivo também precisa ser incluído explicitamente nas permissões e na CSP do `manifest.json` antes de distribuir a extensão.

## Comandos de qualidade

- `npm test`: executa testes do motor, corpus, providers e API.
- `npm run typecheck`: verifica frontend, build e backend com TypeScript estrito.
- `npm run build`: gera somente a extensão em `dist`.
- `npm run build:server`: gera somente a API em `server-dist`.
- `npm run build:all`: gera extensão e API.
- `npm run server:setup`: cria a configuração local ignorada pelo Git.
- `npm run server:local`: compila e inicia o servidor usando `.env.local`.
- `npm run server:check`: diagnostica a conexão e as capacidades do servidor.
- `npm run validate`: executa testes, builds e inspeções de segurança dos dois pacotes.

## Limites atuais

A qualidade das respostas depende da cobertura da base cadastrada. Hoje a base ainda contém poucos serviços. O token compartilhado protege o MVP, mas não identifica cada analista; autenticação individual, auditoria e atualização central da base são evoluções recomendadas para a próxima sprint.
