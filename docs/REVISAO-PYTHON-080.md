# Central da empresa e conferência de Asfalto — 0.8.1

12/11/2026 · Base 2.20.0 preservada. A 0.8.0 foi um estágio de desenvolvimento, não a entrega final.

## Entrega

Incluí catálogo central assinado, detecção limitada da biblioteca OneDrive, consulta e obtenção de pacotes pelo botão do app e instalação por usuário. A pasta prevista é Funcionalidades/AEBOT, separada da AutoForms. Não conectei o ChatGPT ao SharePoint nem alterei permissões corporativas. A pasta de distribuição é preparada/testada no laboratório; publicação e sincronização reais ainda precisam ser confirmadas na empresa.

`Instalar-AEBOT.exe` é o lançador independente, sem modelo. Ele obtém o pacote completo na primeira instalação. Em instalações existentes, o canal escolhe somente o diferencial para a versão e o manifesto exatos. Sem pacote compatível, não substitui silenciosamente tudo nem anuncia que está atualizado. Os arquivos ficam em cache local, com conferência de tamanho, hash e assinatura; a versão nova passa pelo diagnóstico antes da ativação.

O atualizador da versão ativa é usado pelo botão do app, permitindo evoluir a tela mesmo em instalações cujo lançador original é 0.7.0. Mantive pacote manual, rollback e as versões anteriores. Não há envio de chat, leitura de feedbacks, telemetria ou acesso de rede durante uma análise. Consulta de distribuição é explícita; OneDrive cuida da autenticação corporativa.

## Objetos e responsabilidades

| Objeto / módulo | Responsabilidade |
| --- | --- |
| `UpdateChannel`, `ChannelRelease` | Contrato do catálogo, assinatura e escolha por compatibilidade. |
| `ChannelClient` | Operação isolada, prazo e cancelamento do próprio processo de leitura. |
| `ChannelWindow` | Apresentação e confirmação do analista; não decide regras. |
| `RuleStore` | Fonte validada e projeção das duas faixas de Asfalto. |
| `Session`, `CaseFacts`, `Extractor`, `Engine` | Conversa, fatos/contexto, linguagem e avaliação. Não crio uma classe por ID de regra. |
| `AnalysisFlow`, `AnalysisStage` | Mapa gerado e pontos de manutenção, sem outro motor de decisão. |

A orientação a objetos organiza responsabilidades e contratos; não é uma justificativa para copiar regras do JSON para métodos Python. Retirei a tela antiga do atualizador, substituída pela nova com contingência manual. Também retirei a dependência da tela em relação ao ponto de entrada do executável; a abertura agora pertence ao módulo de aplicação de versões.

## Documento e fluxograma

Comparei o TXT de Repavimentação Asfalto e mantive as retificações expressas posteriores do responsável. A matriz está em `CONFERENCIA-DOCUMENTO-ASFALTO.md`. Acrescentei 58 cenários nas duas faixas, além dos anteriores, conferindo regras e decisão.

`export_rulebook.py` gera HTML, SVG, Mermaid, guia e JSON a partir da base. O JSON preserva todos os campos das 39 regras/orientações, inclusive condições e exceções, e identifica o SHA-256 da fonte. O diagrama de etapas separa consultas/hipóteses da OS real, mostra a volta para esclarecimento e a avaliação de todos os fatos antes de concluir.

Esses arquivos não treinam o BGE nem são uma segunda fonte de regras. Uma IA de manutenção encontra o que alterar em `MANTER-REGRAS-ASFALTO.md` e `ARQUITETURA.md`; precisa editar a fonte e os testes e regenerar o mapa. Não deve editar somente o desenho.

## Validação

| Verificação | Resultado |
| --- | --- |
| Unidade Python | 197 testes passaram. Incluem assinatura, corrupção, origem ausente, timeout, cancelamento, proteção de AutoForms e downgrade antes de substituir o instalador. |
| Documento de Asfalto, duas faixas | 58/58 passaram com o modelo real. |
| Auditoria completa com modelo real | 1.512/1.514 passaram em decisão, fundamentos e comportamento; 1.513/1.514 na conclusão esperada. Nenhuma falha técnica; todas as 39 regras/orientações tiveram cobertura. |
| Corpus anterior independente | 52/53 passaram no critério completo; a divergência é a consulta sobre duplicidade descrita abaixo. |
| Cenários semânticos adicionais | 16/16 passaram, com análise offline e independência dos pares conferidas. |
| Janela do aplicativo com modelo real | Passou: envio, fundamentos, três tamanhos, serviço, contexto, hipótese, retificação e feedback sem chat. |
| Janela do atualizador | Passou em três tamanhos, oito controles visíveis e sem carregar ONNX. |
| Fluxograma | SVG renderizado e conferido; projeção preserva todos os campos, condições e exceções da base. |
| Legado TypeScript | 878 testes passaram, 1 ignorado; typecheck, build e validação Manifest V3 passaram. |
| EXE final | Três processos de diagnóstico passaram, com modelo, base, Tk e feedback sintético. |
| Atualizador congelado | Janela e pacote assinado passaram; não carregou ONNX. O processo filho congelado conferiu o canal. |
| Distribuição real em laboratório | Primeira instalação completa, diferencial da 0.7.0 para 0.8.1 e retorno à 0.7.0 passaram; original preservado, seleção compatível e sem usar perfil real ou conta corporativa. |

Relatórios técnicos: `python/artifacts/full-081-2026-11-12.json` e `corpus-081-2026-11-12.json`. A auditoria registra os hashes dos fontes realmente usados, pois a revisão Git também contém alterações locais de tarefas anteriores. Os gabaritos históricos não foram alterados nesta revisão.

O ensaio de distribuição ficou em `python/artifacts/distribution-081-candidate/report.json`. Os guias são atualizados depois desses ensaios, o manifesto é regenerado e os pacotes finais são assinados novamente; os binários e o modelo testados não são recompilados nessa etapa. A central preparada fica em `python/dist/Empresa/AEBOT`, também em `AEBOT-Central-Empresa-0.8.1.zip`. O ZIP portátil completo e as transições manuais são alternativas separadas: não preciso baixar todos para usar.

As duas divergências preservadas são: consulta de duplicidade cita a regra como consulta, sem emitir decisão, enquanto o gabarito espera nenhuma regra; o relato “tem o começo e o pronto, só não tem o pessoal fazendo o serviço” pede esclarecer foto versus execução, enquanto o gabarito espera Não Conforme. A matriz do documento detalha esses limites.

### Tempo observado, não promessa

Na auditoria desta máquina (Windows, 7,87 GiB de RAM), os 109 turnos que chamaram o modelo tiveram média de **2,86 s**, mediana de **2,51 s**, P95 de **5,84 s** e máximo de **7,98 s**. Os 1.574 turnos sem chamada ao modelo tiveram média de **16,6 ms**. São tempos do motor em corpus sintético; não incluem todas as etapas da abertura do EXE nem representam todos os computadores. A preparação do motor dessa rodada levou 8,19 s.

Na rodada adicional executada junto de outras validações, um caso chegou a **16,40 s**. Preservei esse relatório como `semantic-additional-081-concurrent.json`: concorrência e memória disponível afetam o resultado. Esta entrega muda distribuição e rastreabilidade, não anuncia uma aceleração neural que não foi implementada.

Repeti os 16 cenários adicionais em série, sem outras suítes em execução: 16/16 passaram, com máximo de **5,49 s**, mediana de **15,93 ms** (o conjunto mistura caminhos determinísticos e semânticos) e preparação de 5,78 s. Nos três processos novos do EXE final, o diagnóstico inteiro levou 9,00 s, 7,05 s e 8,14 s; cada processo verifica Tk, base, modelo, duas análises e SQLite sintético. A chamada semântica dentro deles levou 2,01 s, 1,50 s e 2,05 s. Não confundo esse diagnóstico completo com o tempo de uma pergunta ou com boot frio do computador. Relatório: `exe-081-2026-11-12.json`.

## Limites

O link privado do SharePoint não é um endpoint público de download. Não implementei OAuth/Graph, não reutilizo sessão do navegador e não solicito aprovação administrativa do ChatGPT. O fluxo depende de a biblioteca estar sincronizada e de o usuário ter acesso. O catálogo offline pode estar atrasado; a tela fala em catálogo sincronizado, não garante o estado instantâneo do servidor.

Preservo original, anterior e estágios; não há limpeza automática de versões. Cancelamento antes da ativação mantém a versão instalada. A instalação fica no perfil local, fora da pasta central. Feedback segue no banco separado já usado; somente o formulário voluntário e versões são persistidos. A chave de assinatura não entra nos pacotes.

O EXE continua sem certificado próprio do AEBOT. Não altero proteções do Windows. Teste em laboratório não homologa liberação e desempenho no Latitude nem comprova todas as formas de linguagem natural.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
