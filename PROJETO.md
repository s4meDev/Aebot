# Objetivo

Criar um Analista Sênior Virtual.

Não é um chatbot.

A IA deve responder dúvidas sobre Ordens de Serviço.

Sempre baseada nas regras da empresa.

Nunca inventar.

Sempre justificar.

---

# Usuários e volume

40 analistas em máquinas e redes diferentes.

Pouco mais de 3.000 Ordens de Serviço analisadas por dia no total.

Os analistas podem enviar feedback escrito sobre respostas, regras ou interface. O responsável deve conseguir consultar os registros persistidos online em acesso administrativo separado.

---

# Interface

Tema Black Dark.

Azul Royal.

Minimalista.

---

# Arquitetura desejada

Frontend React

↓

API online serverless

↓

Rule Engine

↓

Base de regras versionada

↓

Provider de IA substituível e opcional

O Cloudflare Worker é o destino principal do MVP online. O backend Node permanece para desenvolvimento e contingência. Ambos reutilizam o mesmo motor e a mesma base.

Os modelos de suporte também são online. O Gemini 2.5 Flash-Lite atende primeiro às interpretações semânticas e o Workers AI atua como contingência. O motor determinístico responde sem consumir IA sempre que o texto já encontra regra suficiente.

A IA interpreta linguagem livre e humaniza; nunca escolhe ou altera a conclusão determinística.

Cada serviço possui parametrização própria e pode aparecer como serviço original de uma OS. As relações de Troca de Serviço, Adicional Executado e Adicional Posterior (também chamado de desdobro) apontam para os mesmos serviços do catálogo, sem criar cópias. Um serviço cadastrado sem regras permanece com `decision: null` até que suas regras próprias sejam fornecidas.

Reparo de Ramal e Reaterro de Valas possuem diretrizes fotográficas compartilhadas entre suas variações de revestimento. Essas diretrizes verificam local, antes, execução, metragem e finalização conforme o serviço, mas só geram uma das três conclusões oficiais quando existir regra classificatória explícita para o fato observado.

No enquadramento da execução: troca exclusiva do registro usa Substituição de Registro; registro acompanhado de intervenção em outra peça permanece Reparo de Cavalete; intervenção no cavalete e no ramal mantém Reparo de Cavalete com Reparo de Ramal no executado; intervenção somente no ramal usa Reparo de Ramal. Substituição de HD é com custo apenas quando a avaria é atribuída ao cliente e sem custo para os demais motivos, inclusive erro, quebra e furto.

---

# Prioridades

1. Qualidade das respostas.
2. Arquitetura.
3. Performance.
4. Interface.

5. Segurança e privacidade.

6. Operação para 40 acessos remotos.
