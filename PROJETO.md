# Objetivo

Criar um Analista Sênior Virtual.

Não é um chatbot.

A IA deve responder dúvidas sobre Ordens de Serviço.

Sempre baseada nas regras da empresa.

Nunca inventar.

Sempre justificar.

---

# Usuários e volume

Até 60 analistas em máquinas independentes. Piloto inicial com 5 a 10 pessoas.

Pouco mais de 3.000 Ordens de Serviço analisadas por dia no total.

No desktop, feedback é salvo localmente e exportado voluntariamente com métricas para o responsável. Conversas não são persistidas. A coleta central online anterior continua apenas no perfil legado.

---

# Interface

Tema Black Dark.

Azul Royal.

Minimalista.

---

# Arquitetura desejada

Frontend React

↓

Aplicativo Windows (Electron, interface React isolada)

↓

Qwen3-4B-GGUF Q4_K_M em llama.cpp local, com JSON validado

↓

Rule Engine compartilhado e base de regras versionada

↓

Resposta rastreável por serviço, regra, versão, evidência e conclusão

Direção atual: desktop offline por computador, conforme apresentação da coordenação de setembro/2026. Runtime, modelo, regras e interface são distribuídos em um instalador. Cloudflare, API Node e extensão permanecem compatíveis como legado; o desktop não os consulta nem possui fallback para nuvem.

O Qwen interpreta linguagem em fatos rastreáveis (regra candidata, trecho literal e ocorrência/hipótese/consulta). O motor valida os fatos, resolve conflitos e calcula a conclusão. Casos determinísticos já conclusivos evitam inferência desnecessária. Falta do runtime nunca ativa API externa. Não há cobrança por chamada; CPU, RAM e tempo de resposta continuam limitantes.

A IA usa seu conhecimento linguístico para associar linguagem livre, informal, sinônimos, frases incompletas e respostas curtas ao catálogo do serviço. Em dúvidas e casos ambíguos, ela conversa primeiro, responde em até quatro frases e faz somente uma pergunta útil por vez; nunca escolhe ou altera uma conclusão sem apoio do motor.

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

6. Instalação e operação offline em até 60 notebooks, começando com piloto controlado.

# Governança e homologação

Pacotes de regras devem conter responsável, vigência, versão e descrição da alteração. A importação valida o schema, exige versão superior e preserva a base anterior. A distribuição do pacote depende de canal confiável da TI; metadados declarados não são assinatura digital.

O modelo 4B é experimental até homologação. O piloto deve comparar pelo menos 100 perguntas com gabarito revisado por referência operacional, medir divergências críticas e desempenho no Latitude 3420 de 16 GB. Não escalar automaticamente pela aprovação de testes unitários.
