# Operação do piloto e provedores de IA

Este documento explica como colocar o AEBOT em teste, o papel de cada modelo online e o que esperar das cotas gratuitas.

## Estado recomendado

O pacote dos analistas usa uma única API Cloudflare publicada. A ordem atual é:

1. `gemini-3.5-flash-lite`: interpretação principal, priorizando rapidez;
2. `gemini-3.5-flash`: segunda tentativa do Gemini;
3. `@cf/openai/gpt-oss-20b`: contingência no Workers AI;
4. `@cf/qwen/qwen3-30b-a3b-fp8`: última contingência online, multilíngue e com bom custo de entrada.
4. motor local: mantém decisões e orientações já fundamentadas se todos os modelos falharem.

Os modelos podem escrever respostas diferentes. Não é possível prometer que o Workers AI responderá exatamente como o Gemini: o `gpt-oss-20b` é competente em raciocínio, mas tende a ser menos consistente em português informal e em JSON estruturado. A segurança vem do backend: qualquer modelo só associa a linguagem ao catálogo permitido, e o motor recalcula a conclusão oficial.

## Painel de administração

Abra `https://aebot-api.pedrolucasbotelho.workers.dev/admin` e informe o token administrativo. O painel apresenta análises e analistas ativos, conclusões técnicas, respostas locais ou com IA, latência, tentativas e falhas por modelo, tokens quando reportados e feedbacks. Nenhum texto de pergunta, resposta ou histórico é salvo nessa telemetria.

O AEBOT mede o próprio uso, mas não consegue consultar a cota restante do Gemini: o Google aplica RPM, TPM e RPD ao projeto e mostra os limites ativos no AI Studio. Para Workers AI, o painel estima neurons somente quando recebeu os tokens da chamada; a Cloudflare continua sendo a fonte oficial do consumo. Não trate essas estimativas como faturamento.

## Gratuito não significa ilimitado

- A API do Cloudflare Worker possui 100.000 requisições por dia no plano Free. O volume estimado do AEBOT fica abaixo disso.
- Workers AI oferece 10.000 neurons por dia sem cobrança. O consumo depende do modelo e da quantidade de tokens; portanto, isso não equivale a 10.000 conversas.
- O Gemini possui limites de RPM, TPM e RPD aplicados ao projeto, não a cada chave ou token de analista. Os valores ativos devem ser consultados no Google AI Studio porque variam por modelo, projeto e nível da conta.
- Os 40 tokens do AEBOT controlam acesso e auditoria. Eles não multiplicam a cota do Gemini nem do Workers AI.

O motor determinístico não consome IA quando já encontra uma decisão suficiente. Dúvidas ambíguas e linguagem livre usam IA, e o cache reduz repetições dentro de uma instância ativa. A capacidade real só pode ser confirmada medindo o piloto.

## Privacidade no piloto

No nível gratuito do Gemini, o conteúdo pode ser usado pelo Google para melhorar produtos. Não envie número da OS, endereço, nome, matrícula, telefone ou dado confidencial. Para uso empresarial com dados reais, a empresa deve aprovar os termos e considerar um projeto Gemini com faturamento ativo; nos serviços pagos, o Google declara que prompts e respostas não são usados para melhorar os produtos.

A Cloudflare declara que não usa o conteúdo do Workers AI para treinar modelos ou melhorar serviços sem consentimento. Mesmo assim, o AEBOT envia aos modelos somente a dúvida, o histórico recente e o recorte necessário do catálogo. O backend não grava conversas em logs.

## Colocar para rodar agora

No computador responsável pela publicação:

```powershell
npm install
npm test
npm run typecheck
npm run build:production
npm run build:worker
npm run worker:deploy
npm run pilot:check -- https://aebot-api.pedrolucasbotelho.workers.dev
npm run deployment:check -- https://aebot-api.pedrolucasbotelho.workers.dev
```

Depois, em cada computador do piloto:

1. copie a pasta `dist` completa para um local permanente;
2. abra `chrome://extensions`, ative o modo do desenvolvedor e carregue `dist` sem compactação;
3. abra o AEBOT, informe somente o token individual e salve;
4. confirme o indicador `Online · Gemini` ou `Online · Workers AI`;
5. selecione o serviço real e use **Novo caso** ao trocar de OS.

O token fica salvo no perfil do Chrome e não precisa ser digitado depois de recarregar ou atualizar a extensão com a mesma identidade. Desinstalar a extensão ou apagar seus dados remove esse armazenamento.

## Plano de teste

Comece com 3 a 5 analistas por um dia. Use frases reais, mas anonimizadas, e registre feedback quando a interpretação ou a orientação estiver errada. No fim do dia, verifique:

- erros 429 e 5xx no Cloudflare;
- quantidade de chamadas e consumo do Gemini/Workers AI;
- tempo de resposta p50 e p95;
- respostas sem regra ou sem interpretação semântica;
- regras e exemplos que precisam ser refinados.

Só expanda para os 40 usuários após esse resultado. Se a cota gratuita não bastar, mantenha o Gemini como principal com orçamento e alertas controlados; trocar para um modelo mais fraco apenas para evitar custo pode reduzir a qualidade percebida.

## Fontes oficiais

- [Limites da API Gemini](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Preços e tratamento de dados do Gemini](https://ai.google.dev/gemini-api/docs/pricing)
- [Termos adicionais da API Gemini](https://ai.google.dev/gemini-api/terms)
- [Preços e franquia do Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Uso de dados no Workers AI](https://developers.cloudflare.com/workers-ai/platform/data-usage/)
- [Modelo gpt-oss-20b no Workers AI](https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/)
- [Catálogo de modelos Workers AI](https://developers.cloudflare.com/workers-ai/models/)
- [Limites do Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/)
