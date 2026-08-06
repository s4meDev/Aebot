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

A IA interpreta linguagem livre e humaniza; nunca escolhe ou altera a conclusão determinística.

---

# Prioridades

1. Qualidade das respostas.
2. Arquitetura.
3. Performance.
4. Interface.

5. Segurança e privacidade.

6. Operação para 40 acessos remotos.
