# Conversa, contexto e usabilidade — Python 0.9.1

13/11/2026 · Base 2.20.0 preservada · Modelo local BGE/ONNX

A 0.9.0 foi um estágio interno de validação. A entrega 0.9.1 inclui a limpeza do cache de texto da interface ao começar outra OS, além da limpeza já feita pelo motor. O teste da janela confere essa limpeza depois de usar respostas rápidas com rascunho. Os estágios e relatórios anteriores foram preservados.

## O que alterei

O aplicativo agora recupera cada assunto de uma consulta composta, em vez de responder somente à primeira regra. “Foto antes e depois” mantém o objeto declarado; “não de antes” exclui o assunto pedido, sem retirar a negação de uma falta. Comparar aferição no serviço atual e na origem não significa que a OS de origem está ausente. As fontes continuam literais, as condições são as cadastradas e uma consulta nunca classifica uma OS real.

Uma palavra genérica compartilhada por várias regras não encerra sozinha a recuperação: quando necessário, a consulta passa pela interpretação semântica. Se só parte da dúvida for entendida, o assistente explica o trecho fundamentado e pergunta sobre o restante. Não baixei limiares nem acrescentei uma regra de negócio ao motor para obter esses resultados. Uma falha técnica ainda tem código de erro e não conta como acerto.

`PendingConsultation` separa a pergunta incompleta da pendência da OS. “Quis dizer…” depois de uma consulta incompleta esclarece a consulta; não registra a frase como uma nova falha. Uma continuação factual ou uma hipótese segue seu próprio fluxo. Uma hipótese pode usar a base do caso existente, sem gravar os fatos simulados de volta na OS.

`Engine.validate_request` recusa texto/serviço inválido antes de o `Session` alterar o caso. Uma tentativa inválida de “novo caso” não apaga a OS anterior. Em falha semântica com um ponto lexical já sustentado, preservo a explicação desse ponto, mas não emito conclusão da OS incompleta.

Também validei o contrato do ONNX: falta de saída, quantidade errada ou NaN/Inf causam falha técnica. Não preencho o score ausente com zero nem descarto saída extra. Cópia de resposta parcial inclui os IDs de suporte, sem transformar a falha em conclusão.

## Interface

Organizei a tela em conversa e resumo lateral responsivo, mantendo branco, azul e a marca Aegea. `CaseOverview` projeta somente o caso ou a hipótese vigente; uma consulta não entra no resumo factual. Contexto incerto aparece a confirmar, nunca como o valor antigo. Em falha do turno, o resumo anterior não parece um resultado novo.

As respostas rápidas vêm de `pendingContext` e das expressões do catálogo. O analista precisa escolher; não seleciono equipe, frente ou disponibilidade por padrão. O clique mantém um rascunho que também contenha outra ocorrência. O campo permite escrever enquanto a análise roda, mas o envio permanece serializado. Falhas recuperam o texto enviado se não houver um rascunho novo. Copiar é explícito e inclui as referências. Nada disso persiste conversa ou métricas.

O layout compacto reserva envio, feedback e fundamentos. A janela larga mostra contexto e citações; não cria outra fonte de regras. Modelos, versões e feedbacks anteriores permanecem preservados.

## Perfis de CPU

Comparei o mesmo conjunto de 25 pares em série com 4, 2, 1 e novamente 4 threads, com três amostras por perfil e uma chamada de preparação. As médias foram 1,50 s, 2,25 s, 4,18 s e 1,73 s. Os scores permaneceram iguais entre perfis. Nesta máquina, reduzir threads piorou; mantive quatro e um par por inferência, sem quantização dependente de outros candidatos do lote. Isso não prova o melhor perfil em qualquer Latitude. Relatório: `python/artifacts/cpu-profiles-090-2026-11-13.json`.

Não troquei o modelo por outro sem medição. BGE relaciona textos, não é um ChatGPT gerador, não lê fotos e não cria regras ou exceções.

Na auditoria final 0.9.1 desta máquina, os 119 turnos com chamada ao modelo tiveram média de **3,07 s**, mediana de **2,74 s**, P95 de **6,22 s** e máximo de **9,06 s**. Os 1.642 turnos sem chamada ao modelo tiveram média de **10,92 ms**. A preparação do motor nessa rodada levou **22,55 s**; esse pico de abertura permanece registrado, não é apresentado como poucos segundos. A medição não inclui toda a abertura do EXE nem o tempo do usuário; o corpus tem muitas combinações padronizadas. Na rodada anterior 0.9.0, a média semântica foi 2,07 s e a preparação 2,36 s. Essa variação reforça que não posso prometer velocidade universal nem atribuir mudanças de carga da máquina ao algoritmo.

## Validação

| Verificação | Resultado |
| --- | --- |
| Unidade Python | 225 testes passaram, incluindo entradas inválidas, consulta composta, estado da dúvida, resumo, comparação de auditorias e contrato ONNX. |
| Auditoria final real | 1.554/1.556 passaram em decisão, regras e comportamento; 1.555/1.556 na conclusão esperada. Nenhuma falha técnica ou conclusão oficial indevida nesse corpus. |
| Novos cenários | 42/42 passaram nas duas faixas. |
| Documento de Asfalto e retificações | 58/58 passaram; todas as 39 regras/orientações tiveram cobertura. |
| Comparação com 0.8.1 | Sem casos removidos, gabaritos alterados, regressões ou divergências novas. As duas divergências antigas continuam identificadas. |
| Corpus anterior | 52/53 passaram no critério completo; o caso divergente é a consulta de duplicidade. |
| Semântica adicional | 16/16 passaram, sem rede e com independência dos pares; relatório `semantic-091-release-2026-11-13.json`. |
| Interface automatizada com modelo real | Passou em tamanhos compactos/largos: resumo, respostas explícitas, rascunho, recuperação, isolamento da hipótese, cópia simulada e feedback sem chat. |
| Legado | 878 testes passaram, 1 ignorado; typecheck, build e validação Manifest V3 passaram. |
| EXE final | Três processos `--check` passaram, com Tk, modelo, base e SQLite sintético separados. |
| Distribuição real em laboratório | Primeira instalação completa, diferencial da 0.8.1, processo filho congelado, seleção compatível e rollback passaram; original preservado e nenhum perfil real acessado. |
| Conferência visual nativa | A janela 0.9.1 abriu e a apresentação inicial foi conferida. Parei os comandos de tela ao detectar interação no computador; os demais fluxos foram verificados pelo teste programático de Tk. |

Os arquivos finais de referência são `full-091-release-2026-11-13.json`, `comparison-091-release.json` e `corpus-091-release-2026-11-13.json`, em `python/artifacts`. A comparação confere também os hashes dos fontes antes do empacotamento. Rodadas intermediárias são preservadas, não apresentadas como a entrega. A barreira rejeitou uma rodada intermediária da 0.9.1 porque a interface ainda tinha sido editada; a rodada de entrega foi refeita com os fontes congelados.

As duas divergências históricas são: uma consulta sobre duplicidade cita a regra sem classificar a OS, enquanto o gabarito espera nenhuma; uma frase informal sobre “não ter o pessoal fazendo o serviço” pede distinguir falta de registro de não execução, enquanto o gabarito espera Não Conforme. Não removi esses testes para anunciar 100%.

No EXE final, cada processo de diagnóstico inteiro levou **10,36 s**, **9,18 s** e **8,18 s**. A pergunta semântica dentro deles levou **1,86 s**, **1,58 s** e **1,59 s**. Esse ensaio faz também conferências de arquivos, Tk, outra análise e feedback sintético; não é tempo isolado da primeira pergunta nem boot frio do Windows. Relatório: `exe-091-2026-11-13.json`.

O ensaio de distribuição está em `distribution-091-candidate/report.json`. Depois dele atualizo somente os guias e o manifesto antes de assinar os pacotes finais; não recompilo os binários nem troco o modelo testado. O ZIP completo é para primeira instalação. A atualização menor é para quem já usa a versão compatível. A central preparada fica em `python/dist/Empresa-0.9.1/AEBOT`; não foi enviada à conta corporativa nesta tarefa.

Os novos ensaios têm gabarito separado dos históricos. Na revisão dos próprios testes novos, corrigi duas expectativas: a orientação VCG é conferida como regra orientativa, não como ID classificatório; a hipótese que parte de um caso sem foto antes deve conservar esse fato na simulação. Isso não mudou os gabaritos anteriores nem as regras para obter aprovação do modelo.

A primeira auditoria completa detectou três regressões: uma consulta de acabamento foi abstida e duas comparações de equipe pediram um assunto que já estava claro. Preservei essa rodada em `full-090-2026-11-13.json`. Corrigi o reconhecimento de duas palavras específicas do assunto e retirei palavras de comparação da disputa lexical; os limiares semânticos e os gabaritos históricos não foram alterados. A rodada final é separada e precisa passar pelo comparador de regressões antes do empacotamento.

## Limites de distribuição

A atualização permanece assinada por Ed25519; não é certificado Authenticode do EXE. Não altero proteções do Windows. A pasta da empresa precisa ser publicada e sincronizada pelo OneDrive; esta revisão não acessa a conta corporativa nem conecta o ChatGPT ao SharePoint. Não declaro testes no Latitude que não realizei nem prometo acerto universal.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
