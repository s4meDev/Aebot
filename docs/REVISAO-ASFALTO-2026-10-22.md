# Revisão do protótipo Asfalto — 22/10/2026

Versão: Python 0.4.0, base 2.19.0.

## O que mudei

- Refiz a interface em branco e azul, com a marca Aegea do material fornecido. A área de mensagem fica reservada no layout, em vez de depender do espaço que sobra depois do chat.
- Acrescentei a consulta `Regras e fluxo`, com busca e descrição das condições, exceções e orientação de cada regra.
- Organizei as 22 regras oriundas do TXT de Asfalto por assunto, sem mudar suas conclusões. O protótipo usa somente as duas faixas de Asfalto e suas regras compartilhadas aplicáveis. O catálogo histórico não é oferecido como outro serviço no Python.
- O perfil e o pacote recortam os serviços sem duplicar regras no motor. O pacote não precisa carregar os cadastros históricos de Cavalete/Ramal.
- Uma consulta geral pode explicar caminhos condicionais, como equipe interna e terceirizada, sem perguntar sobre uma OS que não foi relatada. Num caso real, os dados que mudam a conclusão continuam obrigatórios.
- Um relato parcialmente entendido passa a explicar o ponto identificado, mas não fecha a OS inteira enquanto houver um ponto relevante sem esclarecimento.
- Separei o estado real de uma simulação. “Mas se faltar foto depois?” não acrescenta essa ausência à OS em análise. Uma resposta curta à pergunta de contexto da hipótese completa apenas a simulação. Perguntas informativas também não viram fatos do caso.

## Onde mantenho as regras

A fonte compartilhada continua com os 36 serviços e 100 regras anteriores. Comparei os campos normativos com a revisão Git de partida: não removi serviços nem alterei conclusões, condições, exceções ou orientações. A base passou de 2.18.0 para 2.19.0 porque organizei as categorias dos 22 cadastros de Asfalto.

O perfil seleciona as duas faixas e preserva também as regras compartilhadas aplicáveis: 37 registros no total. O pacote recebe essa projeção validada, não o catálogo histórico inteiro. O motor permanece genérico.

O guia e o diagrama são gerados por `python/export_rulebook.py`, diretamente da base. O HTML é offline, sem scripts e sem fontes ou imagens remotas. Foi conferido estruturalmente, incluindo os 37 IDs e o hash da fonte. A visualização do HTML no navegador integrado ficou bloqueada pela política de arquivos locais; não contornei essa proteção. A consulta das regras dentro do aplicativo foi inspecionada visualmente.

## Limites que mantive explícitos

O papel do produto é apoiar um Programador de Serviços Sênior: considerar o contexto, consultar as regras e explicar os caminhos possíveis. BGE/ONNX é um relacionador semântico, não um modelo gerador como o ChatGPT. Esta atualização não muda isso nem permite inventar exceções, fatos ou conclusões.

O TXT original não está mais na pasta Downloads nesta máquina. A revisão usa os 22 cadastros identificados com essa fonte e as orientações/exceções anteriores registradas na base. O histórico já registra divergência sobre aferição; mantive a orientação vigente de equipe interna/terceirizada, sem escolher silenciosamente uma nova política. A regra específica de trena impeditiva permanece distinta.

Feedback é voluntário e local. Não há persistência de chat, métricas ou envio para nuvem. O protótipo continua sem assinatura própria e sem promessa de acerto total ou latência universal.

## Validação

Antes da alteração: 70 testes Python aprovados; typecheck e build aprovados; Vitest 875 aprovados e 1 ignorado. A primeira tentativa do Vitest não carregou os testes por bloqueio de cache temporário; a execução autorizada fora do ambiente restrito passou. A primeira chamada Python na raiz não tinha o caminho de módulos correto; a execução no diretório `python` passou.

Resultados da fonte final:

| Verificação | Resultado |
| --- | --- |
| unittest Python | 87 aprovados. Inclui projeção, condições, hipóteses isoladas, perguntas sem interrogação, manifesto, diagrama e feedback. |
| Corpus anterior, modelo real | 52/53 no critério completo; 53/53 na conclusão esperada. Há uma divergência de citação, detalhada abaixo. |
| Auditoria final, modelo real | 1.240/1.244 no critério completo; 1.243/1.244 nas decisões esperadas. Inclui 1.024 combinações explícitas, linguagem informal, retificações, escopos, consultas e hipóteses. |
| Decisões oficiais indevidas na auditoria | 0 nesta amostra. Houve 1 abstenção onde o gabarito esperava decisão. Não é garantia fora da amostra. |
| Falhas técnicas na auditoria | 0. Null por falha técnica não conta como acerto. |
| Cenários semânticos adicionais | 16/16 conclusões esperadas, sem rede; independência do score por par verificada. Não substitui a avaliação estrita da auditoria. |
| Janela com modelo real | Aprovada em 580×500, 1024×650 e 1280×720; envio, dois serviços, esclarecimento, Novo caso, logo, consulta às exceções e feedback voluntário. |
| Compatibilidade do legado | Vitest: 875 aprovados, 1 ignorado. Typecheck e build aprovados. Manifest V3, side panel, service worker, CSP e origem empresarial preservados na conferência estrutural. |

O primeiro Vitest após a mudança encontrou a constante antiga da versão da base; alinhei `RuleStoreValidator.ts` com 2.19.0 e rodei novamente com sucesso. Comparei os hashes do relatório final com a fonte atual: nenhuma diferença. A rodada final é `python/artifacts/full-040-frozen-2026-10-22.json`; as anteriores são intermediárias, não a identificação do código entregue. Os relatórios contêm apenas casos sintéticos e ficam fora do pacote.

### Tempos medidos, por caminho

Na máquina de desenvolvimento, Windows 11, 12 processadores lógicos e 7,87 GiB de RAM física:

| Caminho por mensagem | Média | P95 | Maior tempo observado |
| --- | --- | --- | --- |
| Sem chamada ao modelo — 1.200 mensagens | 6,3 ms | 11,0 ms | 18,6 ms |
| Com chamada real ao BGE — 77 mensagens | 1,53 s | 3,21 s | 4,06 s |

Carregar e verificar o motor levou 2,51 s nessa rodada, separado do tempo da mensagem. A auditoria limpa o cache entre casos independentes e permite reaproveitamento apenas dentro do mesmo caso. Esses tempos não são uma promessa para todos os notebooks nem uma medida de qualidade. A interface com motor sem modelo usada na inspeção visual também não foi usada como benchmark de IA.

### Divergências que permanecem

1. “O que significa duplicidade no Field?” não classifica a OS, corretamente, mas cita a regra classificatória como consulta. O gabarito antigo esperava nenhuma regra classificatória citada. Mantive a divergência visível.
2. “tem o começo e o pronto, só não tem o pessoal fazendo o serviço” pede esclarecimento, em vez de emitir o Não Conforme esperado pelo corpus. Ainda há limite na retomada informal da evidência quando não foi escrito que se trata de foto/registro.
3. “Quero entender o desfecho que ninguém deixou ver” não recupera a regra esperada de foto final. O teste falha nas duas faixas de Asfalto, mesmo com `decision: null`. Não contei isso como recuperação correta nem cadastrei um sinônimo para esconder o limite.

O próximo passo de qualidade é reunir relatos reais, anonimizados e enviados voluntariamente como feedback, e validar o fundamento operacional. O catálogo organizado facilita essa revisão, mas não substitui um modelo generativo ou uma homologação. O TXT original e o conflito de aferição descrito acima também precisam continuar explícitos.

### Janela e pacote

O PyInstaller gerou `python/dist/AEBOT-Python-0.4.0/AEBOT.exe` com recursos, modelo e catálogo do perfil. O diagnóstico da fonte e três execuções do EXE passaram fora do sandbox, conferindo Tk, análise lexical, BGE real, logo/interface e feedback sintético temporário. No EXE, carregar e executar todas essas verificações levou de 3,34 a 3,42 s; só a análise semântica do smoke test ficou entre 0,77 e 0,82 s. São medições diferentes da auditoria completa.

A primeira tentativa restrita do diagnóstico falhou ao criar SQLite na pasta temporária do sandbox (`PermissionError`). Preservei os relatórios de falha e repeti com autorização fora dessa restrição: fonte e EXE passaram. Não alterei antivírus, políticas ou controles do Windows e não tratei essa falha técnica como acerto.

Abri também o EXE e fiz o fluxo visível: “Sem aferição da vala” → pergunta sobre equipe → “interna” → Não Conforme com geração de Retrabalho. Conferi o tema, a seleção, o campo de mensagem e o logo. Fechei a janela de teste sem salvar conversa ou feedback real. O diagnóstico automático de feedback usou banco temporário, não o banco do analista.

A conferência estrutural do Manifest V3 é do legado. Não significa que a nova interface Python seja uma extensão Chrome. A entrega nova é o aplicativo portátil local. A assinatura própria continua ausente (`NotSigned`); executar nesta máquina não garante liberação em outra. Não publiquei release nem alterei o remoto nesta tarefa.

Projeto de **Pedro Lucas Botelho Naus**.
