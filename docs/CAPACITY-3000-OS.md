# Capacidade para 3.000 OS por dia

## Dimensionamento

- 40 analistas;
- pouco mais de 3.000 OS/dia no total;
- média de 75 OS/dia por analista;
- em uma jornada concentrada de 8 horas: cerca de 375 OS/hora ou 6,25 OS/minuto no conjunto;
- uma rajada de 40 solicitações simultâneas foi considerada no desenho.

Mesmo assumindo cinco chamadas HTTP por OS, a carga seria de aproximadamente 15.000 requisições/dia. Isso usa 15% da franquia documentada de 100.000 requisições/dia do Workers Free. O bundle validado localmente tem cerca de 124 KiB, 29 KiB comprimido.

O D1 gratuito permite 5 milhões de linhas lidas, 100 mil linhas escritas por dia e 5 GB totais. Mesmo que os 40 analistas enviem um feedback por dia, a margem é ampla. Os índices adicionam escritas, mas esse volume continua muito abaixo da franquia.

## O que foi validado automaticamente

- lote de 3.000 avaliações determinísticas sem chamada de IA;
- decisão produzida pelo mesmo motor no Node, na extensão e no Worker;
- 40 acessos podem usar identidades independentes;
- limite aplicado por analista, não pelo IP compartilhado da empresa;
- origem CORS exata, token por hash, limite de corpo e respostas sem cache;
- logs estruturados sem pergunta, histórico, resposta ou token;
- build Worker em dry-run com todos os bindings esperados.

O teste local de 3.000 casos possui limite conservador de 15 segundos no equipamento de desenvolvimento. Isso comprova que o motor não é o gargalo, mas não substitui a medição p95 no ambiente Cloudflare.

## Gargalo real: interpretação por IA

O Workers AI possui alocação gratuita diária medida em neurons, não em quantidade fixa de chats. O Gemini também possui limites por projeto. Portanto, nenhum provedor externo gratuito pode ser prometido como ilimitado.

O AEBOT reduz esse risco assim:

1. regra conhecida é resolvida sem IA;
2. IA é chamada somente quando o matching local for insuficiente;
3. a IA apenas associa a linguagem livre a expressões cadastradas;
4. respostas repetidas podem usar cache dentro da instância ativa;
5. se a cota acabar, regras conhecidas continuam funcionando e frases ambíguas retornam sem decisão inventada.

Antes de afirmar que o plano gratuito basta para todas as dúvidas, o piloto deve medir a porcentagem de perguntas que realmente chega à IA e o consumo de neurons no painel Cloudflare. Se essa parcela for alta, o melhor ajuste inicial é cadastrar equivalências recorrentes; somente depois deve ser avaliado um plano pago ou outro provedor.

## Critérios para liberação

- 0 decisões alteradas pelo modelo em testes de regressão;
- 0 segredos no Git ou em `dist`;
- p95 da API medido no piloto e aceito pela equipe;
- taxa de erro 5xx abaixo de 0,5% no piloto;
- taxa de `semantic_unavailable` conhecida e com procedimento operacional;
- 40 tokens individuais provisionados e testados;
- ID estável da extensão e CORS restrito a esse ID;
- responsável definido para publicar novas regras e revogar acessos.

Referências: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) e [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).
