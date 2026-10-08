# Tempo de resposta da IA local

## Correção atual — 2.22.1

Separei cada item de uma coordenação negativa no contrato curto, mantendo o “nem” e a citação literal. Condições, exceções e agregadoras continuam no motor, sobre o relato original. A conferência recebe também título/descrição da regra indicada, sem retirar o catálogo completo. Acrescentei validação de presença para verbos como “vejo” e “vi”: ver o resultado não significa que a foto final esteja ausente.

O cenário crítico passou na repetição isolada v32, mas a rodada ampliada encontrou outra regra indevida na variação “só vejo o resultado”. Preservei a divergência e corrigi a polaridade no v33, sem alterar o gabarito ou a base 2.15.3. As medições 2.22.0 ficam como histórico, não como resultado da versão nova.

### Resultado completo — perfil v33

A rodada `desktop-release/evaluations/2026-10-08T19-31-11-043Z.json` concluiu **51/51 casos**, conferindo também fatos, regras aplicadas e saídas inválidas. Foram 19 casos com IA, 26 chamadas contando conferências e 32 casos determinísticos. Não houve divergência, aprovação indevida, reprovação perdida ou erro técnico do modelo nessa amostra. O gabarito ainda precisa de aceite operacional; esse resultado não garante compreensão de qualquer relato.

O carregamento levou 10,6 s. A mediana dos casos com IA foi 17,7 s; o máximo foi 78,8 s. Os casos determinísticos tiveram mediana de 2 ms, que não representa velocidade do modelo. A máquina usada foi Ryzen 5 5600G com aproximadamente 8 GB; o Latitude de 16 GB ainda não foi medido. A conferência mais contextual melhora esta amostra, mas não comprova redução de latência.

Validação de código: 829 testes aprovados, 1 teste de capacidade separado da suíte regular; TypeScript aprovado. O build desktop deixou de emitir o aviso de `inlineDynamicImports`. O pacote portátil continua sem assinatura própria; a validação de desenvolvimento é separada da abertura do EXE final.

O teste adicional desta versão pela interface e IPC de desenvolvimento também passou (`desktop-release/desktop-smoke.json`, `packaged: false`): inferência real em 27,6 s, Reprovado com a regra final correta e renderer sem Node. Esse teste não substitui a medição dos 51 casos ou a conferência do executável empacotado. Os builds MV3, Node e Worker dry-run, a auditoria da base e o teste separado de 3.000 avaliações passaram.

O protótipo final foi gerado em `desktop-release/prototipo-2.22.1-2026-10-08T19-49-16-448Z/win-unpacked`, com hashes conferidos. A tentativa explícita de iniciar `AEBOT-Prototipo.exe --aebot-package-check` foi bloqueada pelo Controle de Aplicativo do Windows, antes de executar o teste. Não há novo relatório empacotado aprovado: o relatório anterior não valida esta versão. Não alterei proteções ou assinatura para contornar a recusa. A entrega é um pré-lançamento para teste supervisionado, não uma instalação empresarial liberada.

A primeira exportação do download detectou um escape inválido na regex enviada ao PowerShell. Preservei a pasta parcial, corrigi a transmissão literal das barras e acrescentei um teste para caminhos absolutos e `..`. A tentativa parcial não é um download distribuível. O exportador confere o conteúdo descompactado do ZIP e os hashes das partes antes de permitir a publicação.

Também conferi o formato real do ZIP gerado pelo .NET do Windows: as entradas usam barras invertidas, enquanto o manifesto mantém barras normais. O leitor aceita as duas representações para localizar a mesma entrada e continua verificando seu conteúdo por SHA-256. A exportação final passou a conferência do conteúdo; as duas tentativas anteriores foram preservadas, sem publicação.

## Histórico — 2.22.0

Mantive o Qwen3-4B-Instruct-2507 e revisei a base para 2.15.3. A inferência já é nativa em C++; trocar React ou TypeScript não remove a leitura do modelo. Priorizei o gargalo medido e a qualidade das associações, sem fallback de nuvem.

Preparei a leitura do catálogo de Asfalto em um processo isolado, antes da distribuição. Esse programa recebe só IDs da base e aplica o template oficial. Solicita `n_predict=0` e impõe gramática vazia, sem texto de resposta. O runtime fixado ainda contabiliza um token de encerramento; não anunciei esse contador como zero. A preparação exige que o arquivo salvo tenha exatamente os tokens de entrada, sem esse token adicional. O aplicativo **apenas restaura** o recurso; não salva slots com perguntas ou histórico. “Público” aqui significa catálogo sem dados de OS, não publicação na internet.

O build fixa o hash do índice dentro do bundle. A restauração confere também o binário, modelo, versão do runtime, instrução completa e perfil de memória. Se o catálogo mudar, não reaproveita estado antigo. Se uma restauração falhar após tocar a RAM, exige descarte confirmado desse estado; se não confirmar, bloqueia a inferência até reiniciar. Nenhuma falha de cache cria uma conclusão.

Os dois perfis são conferidos em processos separados: janela de 8.192 tokens e de 16.384. O preparador testa a restauração pública entre perfis e só compartilha o arquivo quando tamanho e hash forem idênticos; não presume compatibilidade. Isso não equivale a teste num Latitude de 16 GB. A máquina disponível continua sendo Ryzen 5 5600G com 8 GB, sem aceleração de GPU. O pacote leva somente os arquivos do índice selecionado, preservando preparações antigas no workspace.

Na primeira comparação com restauração (`2026-10-08T16-34-57-849Z.json`), nove cenários passaram: primeira análise 14,9 s, contra 154,1 s sem preparação na referência v24. A carga do modelo levou outros 10,4 s. Perguntas seguintes simples: 6,1–10,5 s; duas falhas com conferência: 37,1 s. Não some ou esconda o tempo de abertura ao descrever a experiência.

Ampliei o corpus para 49 casos, sendo 14 reservados à conversa/IA. Cinco casos novos encontraram três divergências: dupla negação, evidência presente associada à etapa errada e duas ausências na mesma frase. Corrigi a dupla negação considerando os aliases do normalizador; preservei citações diferentes da mesma regra e passei a conferir cada citação/estado, não apenas o ID. A conferência usa campos nomeados: uma variante por linhas compactas descartou fatos válidos e não foi mantida.

Na rodada v27, 13 dos 14 cenários passaram, mas duas etapas ausentes descritas por paráfrase ainda foram confundidas. Não considerei a rodada aprovada. A base 2.15.3 esclarece o que as etapas inicial, em andamento e final comprovam, sem mudar conclusões. Também preservei a oração inteira em “não há X nem Y”: separar antes de “nem” retirava o contexto do segundo item. A rodada final abaixo mede essa combinação e mantém a divergência aberta.

Na revisão seguinte, executei os 49 casos. Corrigi a origem explicitamente informada sendo tratada como falta, e mantive orientações factuais já resolvidas pela base sem nova inferência. A comparação dos casos negativos agora distingue regra consultada de conclusão aplicada, como o contrato já permite; não alterei as decisões esperadas nem contei falha técnica como acerto. O cenário com duas etapas ausentes ainda usou uma regra errada, mesmo acertando o rótulo Reprovado: foi registrado como divergência.

Também conferi `relatedEvidence` e as condições atômicas de `matchPolicy` no catálogo enviado ao modelo. Elas estavam disponíveis ao motor, mas não completas na instrução curta. Passei a enviá-las sem liberar agregadoras ao modelo. A preparação pública evita usar corte de condições como otimização.

O Qwen3.5-2B, mesmo com IDs legíveis e o contrato atual, voltou a omitir resultado final ausente, duplicidade e trena impeditiva. Foi rápido, mas não foi selecionado. Uma rodada foi interrompida tecnicamente antes do fim; o caso seguinte foi repetido isoladamente e também divergiu. Relatórios incompletos e divergentes foram preservados, sem tratá-los como homologação.

Qwen3.5-4B foi repetido no cenário crítico com o contrato v29 desta revisão: 114,6 s de leitura fria e divergência. Um experimento no modelo selecionado com `--temperature=0` também divergiu (48,7 s, catálogo preparado). Não alterei o perfil padrão por essas experiências; `--temperature` é apenas uma opção do avaliador e fica registrada na identidade da rodada.

### Resultado completo — perfil v31

A rodada `desktop-release/evaluations/2026-10-08T18-28-55-061Z.json` terminou com **48 de 49 casos corretos**, conferindo conclusão e regras, não só o rótulo. Foram 17 casos com IA (22 chamadas, contando conferências) e 32 resolvidos sem IA. Não houve aprovação indevida nem saída tecnicamente inválida, mas houve uma reprovação necessária não reconhecida. Não considero isso homologado.

| Medição | Resultado real |
| --- | --- |
| Carregamento do modelo | 8,3 s, separado das análises |
| Primeira análise que chamou a IA | 19,1 s, incluindo restauração |
| Primeira paráfrase após aquecimento | 9,5 s |
| Mediana dos 17 casos com IA | 14,0 s |
| Relatos com vários fatos | aproximadamente 44,7–54,0 s |
| Maior tempo com IA | 83,0 s |
| Casos determinísticos | mediana de 2 ms; não representa velocidade da IA |

O erro restante é crítico: “Não há foto da fase inicial nem de quando aplicaram a massa. A foto do pavimento pronto está lá.” O modelo reconheceu a falta inicial, mas não conservou a falta durante a execução após a conferência. Retornou Não Conforme em vez de Reprovado. Preservei o gabarito e o relatório; não acrescentei um atalho específico para essa frase no motor.

Depois de carregar o modelo, a máquina tinha aproximadamente 284 MB livres. Isso sinaliza pressão de recursos, mas não prova sozinho a causa do pico de 83 s. A comparação no Latitude de 16 GB continua necessária. Uma rodada anterior foi afetada pela execução concorrente do preparador; não usei seu tempo como resultado final.

O índice final contém 5.668 tokens de entrada e dois arquivos públicos de 444.100.044 bytes, um por perfil de memória. Nesta preparação os hashes são diferentes; não forcei o compartilhamento. Ambos os serviços de Asfalto usam o mesmo catálogo. Nenhuma pergunta foi incluída nesses arquivos.

Validação de código: 804 testes passaram, 1 ignorado; typechecks e builds desktop, extensão MV3, Node e Worker dry-run aprovados. O aviso preexistente de `inlineDynamicImports` continua no build desktop. Esses resultados não eliminam a divergência do modelo.

O novo EXE portátil foi gerado, mas sua abertura foi **bloqueada pela política de Controle de Aplicativo do Windows**. Não houve alteração de proteção nem desbloqueio. Um teste anterior também encontrou uma falha no próprio QA: exigia tentativas privadas que o IPC remove. Corrigi usando contadores públicos, sem ampliar a ponte. O teste de desenvolvimento com IA real passou e é separado da conferência do executável; não anuncie a pasta bloqueada como validada para distribuição.

### Executar a preparação e a medição

O teste adicional pela interface e IPC de desenvolvimento passou (`desktop-release/desktop-smoke.json`, `packaged: false`): a primeira paráfrase fez uma chamada real, classificou Reprovado com a regra final correta e levou 20,8 s. Não é medição do EXE final nem dos 49 casos; estes resultados continuam separados.

Pacote final gerado: `desktop-release/prototipo-2.22.0-2026-10-08T18-52-43-897Z/win-unpacked`. Modelo e runtime foram conferidos pelo empacotador. O ASAR tem 98 entradas, sem avaliador nem arquivos privados, e fixa o hash do índice público. A busca em 205 arquivos não encontrou os padrões conhecidos de segredos; não substitui uma auditoria completa. `git diff --check` não encontrou problemas de espaços.

A tentativa bloqueada foi no pacote `prototipo-2.22.0-2026-10-08T18-45-42-290Z`. O pacote final incorpora também o teste semântico explícito de desenvolvimento, mas sua abertura não foi homologada. O relatório `packaged-smoke.json` de 18:41 registra outra tentativa anterior com falha de QA; não é aprovação nem evidência de abertura deste pacote final. Preservei os artefatos anteriores e não tentei trocar a identidade do EXE para escapar da política.

```powershell
npm.cmd run desktop:catalog:prepare -- --service=repavimentacao-asfalto-ate-1m2
npm.cmd run desktop:evaluate -- --corpus=asfalto --offset=35 --limit=14 --prepared --inspect-facts
npm.cmd run desktop:prototype
```

Prepare antes do build/pacote. Repita `--service=ID` para outros catálogos; só a seleção daquela preparação entra no índice. Catálogos idênticos são compartilhados. O aplicativo não pede essa tarefa ao analista. Importar regras diferentes pode voltar a exigir leitura fria; gerar um novo pacote preparado recupera a otimização. Sem `--prepared`, o avaliador mede leitura fria; isso é diferente do padrão otimizado do aplicativo.

`--inspect-facts` pertence somente ao corpus sintético: mostra associações e confirmações booleanas. Não imprime resposta natural ou raciocínio e nunca deve ser usado com conversas reais. O relatório registra restaurações bem-sucedidas, início, progresso, protocolo, recursos, regras aplicadas e erros técnicos. Dois casos de continuação interna/terceirizada são determinísticos, não provas de compreensão pelo modelo.

A API de preparação/restauração e o cache de prefixo são descritos na [documentação oficial do llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md). A compatibilidade foi conferida no runtime fixado do projeto; não presumi que qualquer versão tenha os mesmos recursos.

### Limites que permanecem

Ainda não há comprovação de 2–5 segundos em qualquer pergunta ou ausência de erros. Carga do modelo, geração em CPU e conferência de vários fatos continuam consumindo tempo. A preparação entregue cobre os dois serviços de Asfalto, não todos os demais. Faltam medição no Latitude, casos operacionais revisados e homologação antes de ampliar o piloto. Não desative proteções para executar o pacote.

## Histórico — 2.21.0

Revisão anterior de 08/10/2026, aplicativo 2.21.0, base 2.15.2. Os dados abaixo ficam preservados para comparação, não descrevem o pacote atual.

## Diagnóstico

Separei leitura do catálogo e geração usando os tempos numéricos do runtime. Na referência v18, a primeira pergunta levou 124,7 segundos: 106,4 para processar 3.146 tokens de contexto e 18,2 para gerar 87 tokens. Nas duas seguintes, gerar a resposta ainda consumiu 23,8 e 22,5 segundos.

O computador tem Ryzen 5 5600G e aproximadamente 8 GB de RAM; não é o Latitude 3420 de 16 GB. As rodadas não são um benchmark controlado: memória livre, cache do Windows e tarefas concorrentes variam. Não atribuo toda a demora à RAM nem prometo que aumentar a RAM, sozinho, resolva.

## Alterações

- Catálogo fixo antes do histórico e relato. Serviço depois do catálogo, mantendo a conferência do `serviceId` no motor.
- Todas as regras atômicas do serviço disponíveis, com condições, exceções e orientações. Agregadoras continuam exclusivas do motor.
- JSON curto: `m` (mapeamentos), `s` (trecho), `r` (ID real da regra), `t` (intenção), `a` (orientação opcional) e `q` (pergunta opcional). O modelo não gera outra explicação quando o motor já pode responder.
- IDs das regras legíveis. Substituí-los por posições numéricas confundiu etapas na inferência real; descartei essa variante.
- Citações reconstruídas do relato original. Campos extras, IDs inexistentes, índices inválidos e saída truncada continuam recusados.
- Conferência de associações múltiplas preservada, mas reutilizando o catálogo de sistema e booleanos curtos.
- Respostas determinísticas e devolutivas conhecidas continuam imediatas, sem esperar o modelo.
- Tempos de processamento/geração e tokens em cache no avaliador sintético; nenhuma conversa ou raciocínio do analista é salvo.

O cache é do prefixo em RAM, não de um arquivo de conversa. A separação dos tempos e o reaproveitamento são descritos na [documentação do llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).

## Medições

Na rodada v24 `2026-10-08T15-12-51-807Z.json`, os nove cenários passaram quanto à conclusão, regras e validade técnica, incluindo negações, presença/ausência misturadas e duas falhas independentes. Isso não homologa todos os serviços ou a orientação natural.

| Cenário | Referência v18 | JSON curto v24 |
| --- | --- | --- |
| Primeira pergunta, catálogo sem cache | 124,7 s | 154,1 s |
| Duplicidade em linguagem informal | 32,7 s | 10,9 s |
| Trena impeditiva | 41,5 s | 10,2 s |
| Presença de resultado final | — | 8,5 s |
| Duplicidade negada | — | 6,0 s |
| Continuação interna / terceirizada | — | 5 / 6 ms, sem IA |
| Presença junto de outra ausência | — | 16,8 s |
| Duas falhas com conferência adicional | — | 55,4 s |

A primeira resposta **não melhorou**. O ganho está nas seguintes; preparar o catálogo continua sendo o gargalo inicial. O v25 encurta também a conferência de múltiplas regras: veja o registro final abaixo. Não misture inferência fria e quente para anunciar uma média favorável.

Qwen3.5-2B respondeu a primeira em 24,7 s e as seguintes em aproximadamente 1,5–1,7 s, mas só passou 5/7 cenários: omitiu duplicidade e trena impeditiva. Não o selecionei. Preservei candidatos e rodadas divergentes.

Os experimentos também encontraram schema incompatível e associações indevidas. O avaliador agora reprova falha técnica mesmo se a conclusão final for `null`, e confere associações permitidas nos negativos. Esses experimentos não foram aprovados por terem sido rápidos.

## Conferir no notebook

Use a pasta portátil inteira. Evite duas instâncias e reiniciar a IA entre perguntas. “Novo caso” limpa os fatos, sem reiniciar o modelo. Um catálogo diferente pode exigir nova leitura.

Para quem mantém o código:

```powershell
npm.cmd run desktop:evaluate -- --corpus=asfalto --offset=35 --limit=9
npm.cmd run desktop:evaluate -- --corpus=asfalto --offset=42 --limit=2
```

O padrão é o protocolo do aplicativo. `--compact` compara com o anterior; não é configuração para analistas. `--inspect-facts` só exibe mapeamentos do corpus sintético. Não use perguntas reais no avaliador. Relatórios ficam em `desktop-release/evaluations`; `local-evaluation.json` conserva também o estado de execução incompleta ou divergente.

Meça no Latitude a abertura, primeira pergunta, outras cinco e um relato com vários fatos. Confira orientação e regras, não apenas o rótulo. Defina limites separados para preparação inicial e uso contínuo.

## Limites e próximo passo

Ainda não há comprovação de 2–5 segundos em qualquer pergunta ou de ausência de erros. A leitura fria e as conferências extras limitam o uso em CPU. Faltam homologação dos demais serviços e instalação no notebook corporativo.

Próximo passo: medir no Latitude e investigar pré-processamento/cache **somente do catálogo público**, nunca dos chats, ou aceleração compatível com o hardware. Isso exige nova inferência real, integridade e regressão. Não implementei cache de conversa em disco, fallback de nuvem ou alteração de proteção do Windows para disfarçar o limite.

## Registro final

Na rodada final v25 `2026-10-08T15-19-20-612Z.json`, os dois relatos combinados passaram, sem saída inválida: 165,6 s para o primeiro (frio) e 41,8 s para duas falhas com conferência. Nesta última, a primeira chamada consumiu 19,3 s e a conferência 22,5 s; 20,2 s da conferência foram leitura de 305 tokens novos. A resposta booleana gerou só dez tokens. A preparação e o contexto continuam dominando o tempo, não o texto mostrado na tela.

O recorte de nove casos passou no v24 e a conferência alterada foi revalidada nesses dois casos no v25. Não anunciei uma execução completa do corpus de 44 casos nem homologação operacional.

Validações finais: 717 testes passaram, 1 ignorado; tipos do frontend, ferramentas, desktop e backends aprovados; builds desktop, extensão MV3, Node e Worker dry-run aprovados. O isolamento da ferramenta bloqueou caches/logs temporários de Vitest/Wrangler; repeti fora dele, sem alterar a proteção do Windows. O aviso preexistente de `inlineDynamicImports` no build desktop não impediu compilar. Auditoria: 36 serviços, 99 regras, 8 serviços pendentes e 6 nomes a confirmar.

Pacote novo: `desktop-release/prototipo-2.21.0-2026-10-08T15-26-06-607Z/win-unpacked`. Hashes do runtime e GGUF conferidos; `--aebot-package-check` carregou o modelo real, validou renderer isolado, IPC, catálogo e análise determinística e saiu com código 0. O `app.asar` tem 98 entradas, sem avaliador ou arquivos privados. A varredura de 199 arquivos de código/documentação não encontrou os padrões conhecidos de chaves privadas/API. Isso não substitui auditoria de segurança completa. O protótipo continua sem assinatura própria e sem homologação; use a pasta inteira e respeite bloqueios da empresa.

Projeto idealizado e conduzido por **Pedro Lucas Botelho**.
