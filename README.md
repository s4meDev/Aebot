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

1. Execute `npm run build:server`.
2. No PowerShell, defina a chave apenas para o processo atual, se desejar usar interpretação semântica: `$env:GEMINI_API_KEY="sua-chave"`.
3. Execute `npm run server:start`.
4. Nas configurações da extensão, informe `http://127.0.0.1:8787` como URL do backend.

O endpoint público `GET /health` informa se o servidor está ativo. `GET /v1/services` lista os serviços e `POST /v1/analyze` executa a análise.

### Produção

Em produção, o servidor exige:

- `NODE_ENV=production`;
- `AEBOT_ALLOWED_ORIGINS` com o endereço exato da extensão (`chrome-extension://ID`);
- `AEBOT_API_TOKEN` com um token forte;
- `GEMINI_API_KEY` configurada somente no servidor;
- HTTPS por proxy ou plataforma de hospedagem.

Copie `.env.example` apenas como referência; o projeto não carrega esse arquivo automaticamente. Nunca versione um `.env` real. O domínio HTTPS definitivo também precisa ser incluído explicitamente nas permissões e na CSP do `manifest.json` antes de distribuir a extensão.

## Comandos de qualidade

- `npm test`: executa testes do motor, corpus, providers e API.
- `npm run typecheck`: verifica frontend, build e backend com TypeScript estrito.
- `npm run build`: gera somente a extensão em `dist`.
- `npm run build:server`: gera somente a API em `server-dist`.
- `npm run build:all`: gera extensão e API.
- `npm run validate`: executa testes, builds e inspeções de segurança dos dois pacotes.

## Limites atuais

A qualidade das respostas depende da cobertura da base cadastrada. Hoje a base ainda contém poucos serviços. O token compartilhado protege o MVP, mas não identifica cada analista; autenticação individual, auditoria e atualização central da base são evoluções recomendadas para a próxima sprint.
