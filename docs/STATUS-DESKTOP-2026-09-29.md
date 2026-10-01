# Revisão, diagnósticos e próximos passos — 29/09/2026

## Retomada posterior

O bloqueio descrito abaixo foi resolvido para o runtime de desenvolvimento com a distribuição assinada da Unsloth. A rodada iniciada em 29/09 às 21:48 UTC terminou com 11/12 resultados esperados e duas saídas inválidas do modelo, sem aprovação indevida ou reprovação perdida nesse recorte. A retomada, as correções e a validação atual estão no [relatório de 01/10](STATUS-DESKTOP-2026-10-01.md). As seções seguintes preservam os diagnósticos anteriores; não descrevem o estado atual do novo runtime.

## Atualização após a imagem do erro

Os eventos 3077/3033 confirmaram posteriormente o bloqueio de `ggml-base.dll` sem assinatura pelo Windows, com Smart App Control habilitado. Portanto, a causa antes desconhecida neste relatório foi identificada. Corrigi o empacotamento para exigir assinatura, incluir DLLs e conferir o runtime copiado antes do Setup. O diagnóstico e a proveniência dos hashes assinados estão cobertos por testes.

A suíte passou de 484 para 508 testes aprovados, mantendo um ignorado. Não há certificado utilizável nos repositórios pessoais consultados e o script de diagnóstico também precisa de execução autorizada. Não houve assinatura real, novo Setup ou inferência nesta etapa. O procedimento, as limitações e a dependência da TI estão no [guia de assinatura e liberação](ASSINATURA-E-LIBERACAO-WINDOWS.md). As seções abaixo preservam o histórico da investigação anterior a essa confirmação.

## Resumo da etapa

Retomei a validação do desktop e conferi o estado salvo no repositório. O workspace começou limpo, no commit `995cc96` (`estrutura`). Preservei esse trabalho e não alterei regras de negócio, modelo, interface ou política de privacidade.

Corrigi dois problemas de manutenção: o diagnóstico do runtime escondia algumas falhas atrás de uma mensagem de timeout, e uma avaliação que falhava antes de iniciar deixava o relatório antigo como se fosse o mais recente. Acrescentei 19 testes para essas situações e atualizei os guias, com os créditos de Pedro Lucas Botelho preservados no README.

## O que já estava implementado e foi conferido

A extração local agora usa `EvidenceInterpretation.ts` quando a base fornece grupos inequívocos de evidência. O modelo informa presente, ausente, duvidoso ou não mencionado e aponta os trechos correspondentes. O catálogo considera todas as regras atômicas do serviço; não depende apenas das palavras usadas na seleção inicial de regras.

Só ausência sustentada vira um mapeamento classificatório. Não mencionado, presente ou duvidoso não significa falta. IDs, grupos, citações e modalidade são revalidados, e o motor continua responsável pela conclusão e pela agregação de fatos. Serviços e regras fora desse catálogo seguem o contrato anterior. Nenhuma etapa específica de Cavalete foi fixada no motor genérico.

Isso é uma entrega parcial de K09: ainda não há inventário independente completo de evidências chegando ao motor, e testes de contrato não comprovam que o Qwen escolherá os estados corretos em linguagem livre.

## Correções desta rodada

- `desktop/ModelRuntime.ts`: preserva a falha de processo; distingue ausência de resposta, HTTP 503 durante carregamento, outros erros HTTP e recusa de autenticação. Não atribui a causa à memória ou ao antivírus sem evidência. Se o pedido de encerramento falhar, mantém a referência e bloqueia outro carregamento; não força encerramento por nome. Um sinal aceito ainda não é confirmação de saída do processo.
- `desktop/evaluate.ts`: salva uma rodada incompleta antes de iniciar o runtime, atualiza a cada caso e registra falha com a fase correspondente. Exceções brutas não entram no relatório. Arquivos históricos são preservados.
- `desktop/EvaluationSummary.ts`: valida o progresso e distingue execução concluída de acerto no gabarito. Zero casos executados nunca vira aprovação.
- Testes novos de ciclo de vida do runtime e do avaliador, mais testes de progresso no resumo. Usam processos e cliente simulados, sem inferência real.

Os relatórios novos têm `status`, `completed`, `expectedCases` e, quando necessário, `failure.phase`. Uma interrupção abrupta pode deixar `starting` ou `running`, ambos incompletos. O registro de memória separa antes e depois do carregamento; não mede pico de RAM. Relatórios anteriores não ganham esses campos retroativamente.

## Verificações executadas

| Verificação | Resultado em 29/09 |
| --- | --- |
| Baseline | 465 testes aprovados, 1 ignorado; typecheck e build desktop aprovados |
| Suíte após as mudanças | 484 aprovados, 1 ignorado; 19 novos testes |
| TypeScript | Frontend, ferramentas, Node, Worker e desktop aprovados |
| Builds | Desktop, extensão e servidor Node aprovados |
| Worker | Dry-run aprovado, sem publicação |
| Electron real | Smoke aprovado: renderer isolado, IPC, catálogo e análise determinística |
| Manifest V3 / bundle Node | Validações aprovadas; verificador não encontrou segredos incorporados |
| Auditoria da base | Versão 2.14.0, 36 serviços, 77 regras; estrutura aprovada |
| Integridade offline | Modelo, arquivos do runtime e licenças aprovados pelo verificador |

O Worker precisou de execução autorizada fora do sandbox para acessar seus arquivos de log. O smoke restrito não concluiu e registrou erros de inicialização gráfica; a repetição fora do sandbox passou. Isso não exigiu desativar proteções do Windows. O aviso já existente de `inlineDynamicImports` depreciado continua sem impedir o build.

O smoke não inicia o Qwen e não comprova qualidade da IA. A base ainda tem oito serviços com regras pendentes e seis nomes a confirmar. Nenhuma credencial foi adicionada; a validação de padrões conhecidos não é uma certificação completa de segurança.

## Impedimento para testar o modelo hoje

Duas tentativas do recorte 66–71 não chegaram à inferência: o runtime não ficou pronto em dois minutos, inclusive na execução autorizada fora do sandbox. Até a consulta `llama-server.exe --version`, sem carregar o modelo, ficou sem resposta. Os arquivos passaram na conferência de integridade.

A máquina tinha aproximadamente 1 GB de memória livre em cerca de 8 GB totais numa leitura pontual. Esse dado não prova a causa. Também não foi possível atribuir a falha a dependências, OneDrive ou proteção do Windows. Nenhuma proteção foi desligada e não foi feito download de outro runtime para contornar o problema.

O processo do diagnóstico de versão foi identificado como PID 5016, iniciado às 15:29:49 deste dia no executável `desktop-resources/runtime/llama-server.exe`. A tentativa de encerramento desse processo específico falhou e ele ainda estava ativo na última conferência. Não houve tentativa mais forte ou encerramento por nome; a TI deve conferir caminho e horário novamente, pois PIDs podem ser reutilizados.

Não houve nova avaliação de respostas nesta data. O último relatório real anterior permanece datado de 28/09; não foi substituído por um resultado inventado. A correção do registro de falhas foi validada em testes simulados. Não iniciei outra inferência após constatar o processo sem resposta.

## Experimentos anteriores que precisam ficar claros

Após a primeira etapa registrada no relatório de 28/09, houve outros experimentos no mesmo recorte 66–71:

| Arquivo em `desktop-release/evaluations` | Resultado | Limite da evidência |
| --- | --- | --- |
| `2026-09-28T12-04-32-183Z.json` | 5/6 no perfil direto | Uma saída inválida; quatro casos foram resolvidos sem IA. Antes da última mudança no prompt de sistema. |
| `2026-09-28T12-06-40-427Z.json` | 4/6 com raciocínio limitado a 128 tokens | Uma reprovação esperada não recomendada; dois casos com IA levaram aproximadamente 56 e 70 segundos. |

São amostras repetidas com configurações diferentes, não uma comparação controlada nem uma taxa geral de acerto. Não declarei as divergências resolvidas e não promovi o modo experimental para padrão. A configuração final direta ainda precisa ser medida novamente. Os arquivos são artefatos locais ignorados pelo Git.

## Como retomar

1. Com a TI, resolver a execução do runtime e verificar o processo de diagnóstico identificado acima, sem desligar autenticação ou segurança. Se for necessário reiniciar o computador, salvar o trabalho antes; isso não garante resolver a causa.
2. Seguir `docs/EXECUTAR-E-TESTAR.md` e repetir os recortes 66–71 e 72–77 no perfil direto. Usar `--inspect-facts` somente com o corpus sintético para conferir quais evidências sustentaram a conclusão.
3. Corrigir divergências sem cadastrar frases do teste como regra de negócio. Incluir casos novos, não usados nos ajustes, e revisar orientação, intenção e fatos, não apenas o rótulo final.
4. Revisar o gabarito operacional dos 100 casos e executar o corpus completo. Medir no Latitude corporativo com os sistemas de trabalho abertos.
5. Após aceite técnico e operacional, gerar novo instalador, testar em máquina limpa e liberar o piloto supervisionado de 5–10 analistas.

Não regenerei o Setup, não fiz commit, push, deploy ou liberação para analistas nesta rodada. As mudanças estão no workspace. O Setup 2.18.0 existente continua sendo um artefato anterior; não representa este código. Nenhum arquivo foi removido.
