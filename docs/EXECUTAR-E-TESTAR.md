# Executar e testar o AEBOT

Atualização 2.22.1: a segmentação semântica preserva o “nem” de cada item negado e a conferência recebe descrições dos dados. Para preparar os downloads depois de gerar o protótipo, use `npm.cmd run desktop:download -- desktop-release/prototipo-<versão>-<data>/win-unpacked`. O comando aceita somente o pacote da versão atual, verifica hashes, recusa links/arquivos privados e cria uma pasta nova com ZIP64, partes e instruções de montagem. Não faz commit, push nem publicação; essas etapas continuam explícitas. Não use `Compress-Archive` no GGUF grande.

Para o protótipo 2.22.1, `npm.cmd run desktop:prototype` prepara uma pasta completa com EXE, runtime, modelo e catálogo previamente preparado, sem assinatura própria do AEBOT. Leia [o guia portátil](PROTOTIPO-PORTATIL.md) e [as medições de desempenho](DESEMPENHO-IA-LOCAL.md) antes de distribuir. O comando empresarial `desktop:package` mantém assinatura obrigatória.

Este guia é para quem mantém o código no VS Code. Para o analista que recebeu um instalador, siga o [guia do desktop](DESKTOP-LOCAL.md); não é necessário instalar ferramentas de programação.

## 1. Preparar a máquina de desenvolvimento

Use Windows x64 e Node.js 22.12 ou superior. Reserve pelo menos 10 GB livres para dependências, modelo, runtime e arquivos de build. A máquina de referência do piloto é o Latitude 3420 com 16 GB; isso ainda não é uma garantia de desempenho.

Abra a pasta AEBOT no VS Code e use Terminal → Novo Terminal. Os comandos abaixo devem ser executados na pasta que contém `package.json`.

```powershell
node --version
npm.cmd --version
git status --short
npm.cmd ci
npm.cmd run desktop:assets
npm.cmd run desktop:catalog:prepare -- --service=repavimentacao-asfalto-ate-1m2
```

`npm.cmd ci` instala as versões do `package-lock.json` e substitui a pasta de dependências instalada. Não altera o código do projeto. Faça isso ao preparar uma cópia limpa ou quando as dependências mudarem; não precisa repetir a cada abertura.

`desktop:assets` prepara os arquivos fixados em `desktop-resources/assets-lock.json`, com conferência de integridade. A primeira preparação usa internet. Os binários atuais ficam em `desktop-resources/runtime-b11160-mix-a6922cc` e o GGUF em `desktop-resources/models`; são ignorados pelo Git. O runtime vem da distribuição assinada da Unsloth. A pasta anterior é preservada e não entra no novo pacote.

A extração usa o `tar.exe` instalado no Windows, após conferir o SHA-256 do ZIP e os nomes das entradas. Não exige o módulo de extração PowerShell. Uma pasta incompleta, arquivo alterado ou DLL extra interrompe a preparação; não edite os hashes para aceitar a divergência.

Use `npm.cmd`, e não mude a Execution Policy para `Unrestricted` apenas para executar o projeto. Se a TI bloquear Node, Electron ou llama.cpp, solicite autorização em vez de desativar a proteção.

## 2. Abrir o aplicativo completo

Neste workspace já preparado, também é possível abrir `Abrir-AEBOT.cmd` pela pasta do projeto. Ele usa o executável Electron existente e o build já compilado, sem reinstalar dependências. Não é instalador nem pacote autônomo. O recorte atual é [Repavimentação Asfalto](PROTOTIPO-ASFALTO.md); selecione o serviço conforme a OS.

```powershell
npm.cmd run desktop:start
```

Para avaliar Asfalto com IA real: `npm.cmd run desktop:evaluate -- --corpus=asfalto --prepared`. O corpus tem 51 casos; o recorte `--offset=35 --limit=16` inclui paráfrases, negativos, continuações e vários fatos. O padrão usa o protocolo curto do aplicativo; `--compact` compara com o anterior. Sem `--prepared`, mede leitura fria sem restauração. O relatório separa carga do modelo, restauração, leitura, geração e tokens em cache, além de conclusão, regras e falhas técnicas. Não confunda inferência real com matching lexical ou primeiro uso com perguntas em cache.

`desktop:catalog:prepare` é tarefa do mantenedor, não do analista. Pode repetir `--service=ID` para preparar outros catálogos; o índice publicado contém apenas a seleção daquela execução. Não recebe pergunta ou histórico. Refaça a preparação antes do build/pacote se mudar o catálogo ou a instrução local. A importação de regras no aplicativo não usa um cache antigo: se o prefixo mudar, faz a leitura normal. Não salve slots do runtime durante um chat.

O comando verifica o TypeScript do desktop, compila os arquivos e abre o Electron. Aguarde o carregamento da IA nas configurações. Selecione o serviço e use perguntas sintéticas, sem dados pessoais, nesta fase.

Não há recarga automática do código nesse comando. Feche a janela e execute novamente após alterar arquivos. O runtime inicia em uma porta temporária local; não tente configurar uma porta fixa ou abrir `127.0.0.1:8787` para usar o desktop.

Em desenvolvimento, o aplicativo normal utiliza o perfil AEBOT do usuário do Windows. Não use essa execução para importar pacotes de teste sobre uma base pessoal importante sem preservar seus dados. O comando `desktop:smoke` usa um perfil separado.

## 3. Verificar o código antes da entrega

Para conferir também uma paráfrase com IA real pela ponte do aplicativo, execute `npm.cmd run desktop:smoke -- --aebot-smoke-semantic`. O resultado fica em `desktop-release/desktop-smoke.json`, com `packaged: false`; não valida o EXE distribuído. Nesta revisão passou com uma chamada real e 20,8 segundos de análise. O teste normal sem essa flag continua determinístico e não inicia o modelo.

O EXE 2.22.0 gerado foi bloqueado pelo Controle de Aplicativo do Windows. Não altere proteções para abrir; a distribuição exige resolver a assinatura/liberação pelo canal autorizado. Testes de desenvolvimento aprovados não substituem essa etapa nem a homologação da IA.

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run rules:audit
npm.cmd run desktop:smoke
```

- `test`: testes automatizados do código, sem inferência real do Qwen.
- `typecheck`: tipos do frontend, ferramentas e backends legados. A checagem específica do desktop ocorre em `desktop:build`, também chamado pelo smoke.
- `rules:audit`: estrutura e pendências da base; não aprova o conteúdo de negócio.
- `desktop:smoke`: abre uma janela de teste não exibida, verifica isolamento, IPC, catálogo e uma análise determinística. Gera `desktop-release/desktop-smoke.json` e uma captura de tela. Não mede a inteligência do modelo nem instala o Setup.

Se alterar o núcleo compartilhado, valide também os perfis legados:

```powershell
npm.cmd run build
npm.cmd run build:server
npm.cmd run build:worker
node scripts/validate-extension.mjs
```

`build:worker` é um dry-run: compila sem publicar. `worker:deploy` publica de verdade e não deve ser usado como teste.

## 4. Avaliar a IA real

Feche outras instâncias do AEBOT antes da medição para não executar dois modelos ao mesmo tempo. Não compare tempos enquanto outro build ou tarefa pesada disputa CPU/disco.

```powershell
# Amostra curta; índice inicial é zero.
npm.cmd run desktop:evaluate -- --offset=66 --limit=6

# Mesma amostra no modo experimental de raciocínio.
npm.cmd run desktop:evaluate -- --offset=66 --limit=6 --thinking

# Experimento com orçamento menor (32 a 512 tokens; padrão 512).
npm.cmd run desktop:evaluate -- --offset=66 --limit=6 --thinking --thinking-budget=128

# Inspecionar somente os fatos interpretados do corpus sintético.
npm.cmd run desktop:evaluate -- --offset=66 --limit=6 --inspect-facts

# Corpus técnico completo, no perfil padrão.
npm.cmd run desktop:evaluate
```

O corpus tem 100 casos técnicos propostos de Cavalete. A rodada completa pode demorar bastante; o runtime usa CPU e cada chamada pode esperar até três minutos. O tempo de um caso com várias chamadas pode ser maior. A flag `--thinking` afeta somente o avaliador, não habilita esse modo no aplicativo.

A rodada é salva em `desktop-release/evaluations/<data>.json` antes de carregar o runtime e a cada caso concluído. `local-evaluation.json` contém a rodada mais recente, inclusive uma falha de inicialização com zero casos. Confira `status` (`starting`, `running`, `completed` ou `failed`), `completed`, `expectedCases` e `failure.phase`. Uma interrupção abrupta pode deixar `starting` ou `running`; não significa conclusão. Casos já salvos são preservados, mas o caso em andamento pode não estar no arquivo. Relatórios anteriores a 29/09 não possuem todos esses campos.

O relatório contém versões, hashes do modelo, do recorte do corpus e do avaliador compilado, CPU/RAM da máquina, tempo de inicialização, divergências, chamadas, tokens reportados e latências. Também registra `interpretationProtocol` e `runtimeConfiguration`, para conferir o protocolo e o contexto realmente usados. O hash do avaliador distingue alterações de código mesmo antes de mudar a versão do pacote. Não inclui nome do computador, usuário ou conversas reais. A memória livre é uma fotografia antes e depois do carregamento, não o pico de RAM; a medição posterior fica nula quando o runtime não inicia. `--inspect-facts` não imprime resposta natural, raciocínio ou credenciais; use apenas o corpus sintético previsto. Os experimentos não mudam o perfil padrão do aplicativo.

O cliente local padrão usa protocolo curto com IDs legíveis, cache de atenção q8, flash attention e nenhuma reserva de slots antigos em RAM. Em máquinas abaixo de 12 GB, o contexto é 8.192 tokens; nas demais, 16.384. O aplicativo 2.22.0/base 2.15.3 restaura a leitura pública quando houver recurso compatível. Sem `--prepared`, o avaliador mede leitura fria; com a opção, mede o caminho preparado do aplicativo. A carga inicial do modelo fica separada da primeira análise. Compare rodadas com a mesma máquina e configuração; resultados anteriores são históricos.

Para comparar candidatos, prepare somente uma vez com `node scripts/prepare-model-candidate.mjs qwen3instruct` (ou `qwen35`/`qwen35lite`) e avalie com `npm.cmd run desktop:evaluate -- --corpus=asfalto --candidate=qwen3instruct --offset=35 --limit=7 --inspect-facts`. A seleção é técnica e não muda o lock do aplicativo. Não abra o AEBOT ao mesmo tempo da avaliação.

Os tempos dos casos com chamada à IA ficam separados dos casos sem chamada. Isso evita esconder a demora do modelo atrás das respostas rápidas do motor. `medianMs` é o tempo central; `p95Ms` usa a posição correspondente a 95% das medições ordenadas. Em amostras pequenas, pode ser o maior tempo observado, não uma previsão estatística confiável.

Saída `1` indica divergência ou erro de execução; leia o relatório e o terminal para distinguir. Um resultado `null` esperado não prova que a orientação em português estava boa. O responsável operacional ainda precisa revisar o gabarito, as regras aplicadas e a resposta apresentada.

Casos podem declarar `expectedClassifyingRuleIds`: nesses casos, uma classificatória extra ou ausente também reprova o teste, mesmo quando a conclusão final coincide. Regras orientativas consultadas ficam fora dessa comparação. Os casos de imóvel errado, chassi ilegível e parametrização ausente usam esse critério para evitar um falso acerto por rótulo.

## 5. Gerar e entregar o instalador

Após validar o código e os arquivos offline, configurar a assinatura real com a TI e autorizar a conferência PowerShell conforme o [guia de liberação](ASSINATURA-E-LIBERACAO-WINDOWS.md):

```powershell
npm.cmd run desktop:signing:check
npm.cmd run desktop:package
```

`desktop:signing:check` verifica somente a presença de configuração e a obrigatoriedade da assinatura. Não comprova validade, acesso à chave privada ou identidade do publicador. Sem configuração, o empacotamento para antes de copiar arquivos ou gerar um Setup novo. Com a credencial disponível, o builder e a conferência posterior ainda precisam passar.

Entregue os quatro arquivos indicados no [README](../README.md#rota-atual-desktop-offline). Um hash confere integridade, mas não prova a origem de um pacote se o arquivo de hashes também veio de uma fonte não confiável. Use o canal aprovado pela TI.

O destino exige pelo menos 4 GB livres além dos arquivos de distribuição. A primeira abertura confere o modelo e pode demorar. O builder agora exige assinatura e verifica o runtime copiado antes do Setup; o instalador antigo continua sem assinatura. Ainda falta validar uma geração completa com certificado real. Não oriente o usuário a ignorar alertas ou desligar o antivírus.

## 6. Manter as regras

Edite `src/data/rulesStore.json` com o [guia de regras](COMO-EDITAR-REGRAS.md), acrescente casos de regressão e aumente a versão. Depois:

```powershell
npm.cmd run desktop:rules -- --owner="Nome do responsável" --changes="Descrição da revisão aprovada"
```

O pacote sai em `desktop-release/rules-release.json`. No aplicativo, importe em Configurações → Importar regras aprovadas. Não altere o GGUF para atualizar regras. Versão igual ou inferior é recusada; uma correção exige nova versão.

## Problemas comuns

| Sintoma | O que verificar |
| --- | --- |
| `npm.ps1` bloqueado | Use os comandos `npm.cmd` acima, sem mudar a política da empresa. |
| `ggml-base.dll` / `0xC0E90002` | O runtime antigo foi bloqueado. Prepare o runtime assinado com `desktop:assets` e recompile; reinstalar o Setup antigo não o atualiza. Se persistir, siga o [guia de assinatura](ASSINATURA-E-LIBERACAO-WINDOWS.md). `desktop:doctor` exige o script autorizado. |
| Runtime não respondeu no endereço local | Confira integridade do pacote e peça à TI para verificar inicialização do executável, dependências e loopback. Não conclua que é memória ou antivírus sem diagnóstico. |
| Modelo não terminou de carregar | O runtime respondeu HTTP 503; confira recursos disponíveis com o suporte. |
| Credencial temporária recusada | Solicite suporte; não desative autenticação nem configure uma chave fixa. |
| Não foi possível encerrar a IA anterior | Não abra várias instâncias nem force encerramento por nome. Solicite à TI a inspeção do processo identificado. |
| Funciona no navegador, mas sem Qwen local | `dev` não abre o Electron. Use `desktop:start`. |
| URL ou token sendo solicitado | Você abriu o perfil legado, não o aplicativo desktop. |
| Setup não encontra o modelo | Mantenha o GGUF com o nome original na mesma pasta do Setup. |
| Modelo corrompido | Recupere o pacote pelo canal confiável; não remova a verificação de SHA-256. |
| Pergunta informal demora ou fica sem decisão | Registre um exemplo anonimizado para avaliação; não troque por aprovação automática. |
| Feedback não pôde ser salvo | Leia o erro; arquivo ilegível ou limite local exigem recuperação/exportação com suporte, não exclusão dos dados. |

## Encerrar e retomar

Feche o aplicativo para encerrar o runtime. Conversas não voltam após reabrir. Métricas, feedbacks e regras importadas ficam no perfil local; não apague essa pasta para atualizar. Para outro caso no mesmo atendimento, use Novo caso.

Antes de continuar o desenvolvimento em outro dia, confira `git status`, leia [AGENTS.md](../AGENTS.md) e o [plano de validação](PLANO-DE-VALIDACAO-DESKTOP.md). Não confunda um relatório antigo ou um Setup já existente com uma compilação do código atual.
