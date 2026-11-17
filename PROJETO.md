# Direção atual — 15/11/2026

Para os testes de 16/11, a primeira instalação deve ser um único ZIP offline com Instalar-AEBOT.exe, pacote completo assinado, manual e roteiro. O destino padrão é o perfil do usuário Windows. Instalar confere arquivos e executa o diagnóstico real do aplicativo antes de liberar Abrir AEBOT; não sobrescreve instalações existentes. Não depende de publicação SharePoint ou configuração técnica pelo analista. O motor 0.9.1 e a base 2.20.0 permanecem iguais à revisão auditada. Esta entrega não é certificado Authenticode nem homologação de todas as máquinas. Guia: `docs/INSTALAR-TESTE-ASFALTO.md`.

Na revisão Python 0.9.1, consultas compostas recuperam seus assuntos sem criar fatos. Esclarecimento de consulta usa estado separado da OS e da hipótese. A interface projeta contexto/citações em um resumo responsivo, oferece somente escolhas cadastradas para a pergunta pendente e preserva rascunhos. A base 2.20.0, modelo, análise offline e assinatura do atualizador permanecem. Resultados e limitações: `docs/REVISAO-PYTHON-090.md`.

Na revisão Python 0.8.1, a análise permanece local e a distribuição usa uma pasta AEBOT da empresa sincronizada pelo OneDrive, separada da AutoForms. O app procura e obtém atualizações assinadas após confirmação; o instalador independente obtém o pacote completo na primeira instalação. Não há conexão do ChatGPT ao SharePoint. A publicação e sincronização reais ainda precisam ser confirmadas. Veja `docs/DISTRIBUIR-EMPRESA.md` e `docs/REVISAO-PYTHON-080.md`.

Na revisão Python 0.7.0, incluí a atualização diferencial assinada por arquivo, preservada como contingência. O lançador ativa a pasta nova somente depois de validação e diagnóstico, preservando original, anterior e feedback. O modelo igual não precisa entrar no download. Veja `docs/ATUALIZAR-AEBOT.md` e `docs/ATUALIZACOES-PYTHON-070.md`.

Na revisão Python 0.6.3, a interface é branca e azul, com identidade Aegea e foco no chat. A resposta curta e os fundamentos completos ficam separados. Negação de falta não confirma ausência; alternativas, vínculos contraditórios e declarações de incerteza não confirmam equipe. Uma confirmação retirada não pode sustentar a conclusão. Consultas intermediárias não confirmam a hipótese nem alteram o caso real. Seleção e pacote ficam limitados às duas faixas de Repavimentação Asfalto. O papel desejado é apoiar um Programador de Serviços Sênior: consultar a base, explicar combinações e exceções e pedir esclarecimentos úteis. Orientação condicional não é decisão de uma OS real.

A retificação de 03/11 sobre trena impeditiva está na base 2.20.0: na OS atual, interna recebe Não Conforme com Retrabalho; terceirizada recebe Reprovado; sem vínculo, perguntar. A confirmação do responsável prevalece sobre o cadastro anterior.

Esclarecimentos devem identificar o trecho ambíguo; uma retificação explícita substitui só esse ponto, preservando os demais fatos. Cache permanece limitado ao caso em RAM. Cobertura das regras, divergências de fundamento, abstenções e falhas técnicas precisam aparecer separadamente na validação. Entrega atual: `docs/REVISAO-PYTHON-063-2026-11-12.md` e `docs/USAR-ASFALTO.md`. A prontidão de 03/11 permanece histórica, não substitui a conferência desta entrega.

Campo de mensagem e ações devem continuar visíveis em 580 × 500. O perfil só seleciona o catálogo; regras continuam no JSON compartilhado. Guia e diagrama são gerados da base. Tema dark e arquitetura React/Electron abaixo pertencem ao legado.

A implementação nova em avaliação usa Python, Tkinter e inferência ONNX local, inicialmente nas duas faixas de Repavimentação Asfalto. A regra permanece no JSON compartilhado. O objetivo é reduzir a demora sem terceirizar a conclusão para a IA. Não considero 100% de acerto ou poucos segundos em qualquer notebook como resultado comprovado.

O fluxo Electron/Qwen abaixo fica como histórico, não como obrigação de usar esse runtime na versão Python. Documentação atual: `docs/EXECUTAR-PYTHON.md`, `docs/STATUS-PYTHON-2026-10-19.md` e seção inicial de `ARQUITETURA.md`.

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
