# Como executar o AEBOT Python

## Só quero usar

Para a entrega de testes de 16/11, uso o **[instalador offline com manual](INSTALAR-TESTE-ASFALTO.md)**. Extraio o ZIP completo, abro Instalar-AEBOT.exe, clico em Instalar AEBOT e aguardo a conferência do EXE. O destino padrão é `%LOCALAPPDATA%\AEBOT\Application`; depois abro Abrir-AEBOT.exe dali ou por atalho. A instalação não precisa da pasta corporativa sincronizada. A pasta portátil abaixo permanece uma alternativa, não um segundo download obrigatório.

O pacote local 0.9.1 reúne aplicativo, lançador, modelo e runtime. As instruções abaixo usam essa pasta completa, não os pacotes antigos do GitHub. Dentro dela, começo pelo `00-COMECE-AQUI.txt`, sigo `COMO-USAR.md` e confiro `RESULTADOS-TESTES.md`. Para instalações existentes, veja [Como atualizar](ATUALIZAR-AEBOT.md); o `.aebot-update` leva só diferenças e não baixa o modelo igual novamente. O botão também obtém o pacote na pasta da empresa sincronizada, após publicação e confirmação do usuário.

O [guia de transferência](../COMO-BAIXAR-EM-OUTRO-PC.md) explica o pacote local 0.9.1 e a central da empresa. Não use “Source code (zip)” para instalar: ele não contém EXE nem modelo.

1. Abra `python/dist/AEBOT-Python-0.9.1.zip` e extraia tudo.
2. Entre na pasta extraída e abra `Abrir-AEBOT.exe`.
3. Aguarde “IA local pronta”, escolha a faixa de área de Asfalto e descreva a OS.
4. Se ele perguntar o tipo de equipe, responda “interna” ou “terceirizada”.
5. Para outra OS, clique em **Novo caso**. Fechar a janela também descarta a conversa.
6. Use **Enviar feedback** para relatar um problema e **Feedbacks salvos** para consultar, exportar ou importar os relatos. Veja [como reunir feedbacks](FEEDBACK-PYTHON.md).
7. Em **Regras e fluxo**, consulte os critérios, condições e exceções. O diagrama abre no navegador sem internet.
8. Se o assistente apontar um trecho ambíguo, use uma retificação natural como “Quis dizer: ...”. Isso substitui só aquele ponto; acrescentar outra falha não apaga a dúvida.

Não instale Python nem informe chave. Copie a pasta inteira, nunca só o EXE. O pacote não baixa componentes ao abrir. O modelo local não tem cota de API, mas depende da memória e CPU disponíveis. Não desative proteções do Windows se o aplicativo for bloqueado: guarde a mensagem para diagnóstico. Este protótipo ainda não tem certificado próprio.

## Vou desenvolver ou editar regras

### Preparar a primeira instalação offline

Preservo o pacote assinado 0.9.1 já testado. Não recompilo o motor para mudar o invólucro de instalação. Uso destinos inéditos, pois os scripts recusam sobrescrever entregas:

```powershell
.\.venv\Scripts\python.exe python/package_offline.py --package python/dist/AEBOT-completo-0.9.1.aebot-update --output python/dist/AEBOT-Instalar-0.9.1-Testes-16-11-2026
```

Antes de fechar o ZIP, executo o instalador gerado com `--check --root <pasta absoluta nova de laboratório> --report <JSON absoluto novo>`. Esse ensaio realmente instala e roda o diagnóstico do EXE, sem usar o destino padrão nem o feedback do usuário. Também executo `python/test_offline_setup.py` e os testes de unidade. Depois uso `package_offline.zip_delivery` com a pasta preparada; ele confere o manifesto e cria um ZIP novo. Nunca publico a chave privada, diretório artifacts ou perfil Windows. A identidade do pacote fica incorporada ao EXE do instalador; editar um JSON ao lado dele não troca o pacote aceito.

O instalador offline não substitui o canal de atualizações. As instalações seguintes usam Abrir-AEBOT.exe e os pacotes diferenciais compatíveis; não misturo os arquivos por cima da instalação.

Pré-requisitos: Windows x64, Python 3.12 com Tkinter; internet apenas para preparar dependências e modelo. No PowerShell, dentro da raiz do projeto:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python/requirements.txt
.\.venv\Scripts\python.exe python/prepare_model.py
.\.venv\Scripts\python.exe python/main.py
```

Usei Python 3.12.14 nesta rodada. `python/environment-tested.txt` registra todas as versões instaladas, inclusive dependências transitivas e ferramentas de build; `requirements.txt` contém apenas as dependências diretas de execução. O caminho do Python usado para criar o ambiente precisa continuar existindo enquanto desenvolver; o EXE distribuído não depende dele.

Regras: `src/data/rulesStore.json`. O campo opcional `semanticCriteria` descreve a condição de uma regra, não cadastra uma decisão diferente. A severidade, as condições obrigatórias, as exceções e a orientação continuam nos campos próprios. Não precisa recompilar pesos ao mudar regras; precisa validar a base e refazer os testes. O pacote distribuído usa uma cópia em `resources/src/data/rulesStore.json` e carrega a base novamente ao abrir.

Na base 2.20.0, `interpretation` declara escopos, objetos de registro e alternativas de equipe/frente/etapa/troca. `evaluation` liga uma regra ao fato, ao escopo e aos valores exigidos ou incompatíveis. `perStatement` evita aplicar o “antes” de uma oração ao “depois” de outra. Para regras assim anotadas, os valores ativos resolvem equipe/frente: não uso a equipe antiga concatenada na conversa como condição vigente. Mantenho os campos lexicais anteriores para compatibilidade com o legado. Veja [a revisão atual](ATUALIZACAO-TRENA-2026-11-03.md).

`python/catalogProfile.json` seleciona as duas faixas de Asfalto. A base compartilhada continua completa; o carregador e o pacote projetam somente os serviços selecionados e suas regras aplicáveis, preservando condições e exceções. O papel de Programador de Serviços Sênior não transforma o BGE em um modelo generativo. Hipóteses não entram no estado real da OS. Consulte [Manter regras](MANTER-REGRAS-ASFALTO.md).

## Testes e verificação

O teste semântico aceita destino novo e registra a rodada antes de carregar o modelo:

    .\.venv\Scripts\python.exe python/test_semantic.py --output python/artifacts/semantica-minha-revisao.json

Para comparar perfis de CPU sem mudar a configuração do aplicativo:

    .\.venv\Scripts\python.exe python/benchmark_reranker.py --output python/artifacts/perfis-cpu-minha-revisao.json

Rodo medições de inferência em série, sem duas instâncias ou outras suítes pesadas concorrendo. Benchmark usa somente perguntas sintéticas e não autoriza telemetria do aplicativo.

Depois da auditoria, comparo com a referência anterior, sem mudar expectativas históricas para anunciar melhora:

    .\.venv\Scripts\python.exe python/compare_audits.py --before python/artifacts/full-081-2026-11-12.json --after python/artifacts/full-091-release-2026-11-13.json --output python/artifacts/minha-comparacao.json

O comparador falha se faltar caso, houver gabarito alterado, regressão em um caso antes aprovado, falha técnica ou divergência nos casos novos. Também confere os hashes dos fontes atuais: se o código mudou durante a auditoria, refaço a rodada antes de empacotar. Divergências históricas continuam visíveis e não viram acerto. Uma mudança legítima de regra exige revisão explícita do gabarito e da referência, não um bypass silencioso do comparador.

Para resultados atuais, consulte [a revisão 0.9.1](REVISAO-PYTHON-090.md); as revisões anteriores permanecem como histórico. Passar nos testes de unidade não significa acertar todas as situações de linguagem livre. O chat mostra a forma curta; Ver fundamentos mantém todos os critérios e trechos, incluindo pontos que não confirmaram uma falha. Se a preparação falhar, confira a pasta e use Tentar novamente, sem alterar proteções do Windows.

Consultas intermediárias usam a pergunta atual sem alterar o estado factual. Posso perguntar outra regra durante uma hipótese e depois responder ao contexto pendente. Para retomar a OS em vez da hipótese, escrevo `Voltando ao caso real: ...`. O benchmark abaixo usa somente exemplos sintéticos e recusa sobrescrever relatórios anteriores; nunca mede nem salva conversas reais:

```powershell
.\.venv\Scripts\python.exe python/benchmark_conversation.py --output python/artifacts/benchmark-novo.json
```

```powershell
$env:PYTHONPATH = 'python'
.\.venv\Scripts\python.exe -m unittest discover -s python/tests -v
.\.venv\Scripts\python.exe python/audit_asphalt.py --suite full --repeat 3 --output python/artifacts/nova-rodada.json
.\.venv\Scripts\python.exe python/audit_asphalt.py --suite acceptance --repeat 3 --output python/artifacts/aceitacao-nova.json
.\.venv\Scripts\python.exe python/audit_asphalt.py --suite readiness --repeat 3 --output python/artifacts/prontidao-nova.json
.\.venv\Scripts\python.exe python/evaluate.py --output python/artifacts/corpus.json
.\.venv\Scripts\python.exe python/test_semantic.py
.\.venv\Scripts\python.exe python/test_app.py
.\.venv\Scripts\python.exe python/main.py --check
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

`evaluate.py` imprime divergências mesmo quando a execução termina normalmente; confira `passed` e cada linha do relatório, não apenas o exit code. Hipóteses são comparadas pela conclusão **condicional** (`scenarioDecision`), mantendo `decision: null`. Não use a mediana geral de casos lexicais como se fosse tempo só de IA.

A auditoria completa também registra cobertura por regra (`ruleCoverage`), regras nunca encontradas (`uncoveredRules`) e classificatórias sem relato afirmativo sintético (`classifyingRulesWithoutRealFact`). “Fato” aqui é o estado do caso sintético, não uma OS real homologada. `Match.application` identifica `fact`, `consultation` ou `scenario`; o gabarito antigo é mantido, incluindo suas divergências de citação.

## Gerar uma entrega nova

```powershell
.\.venv\Scripts\python.exe -m pip install -r python/requirements-build.txt
.\.venv\Scripts\python.exe python/export_rulebook.py
.\.venv\Scripts\python.exe python/package_app.py
.\.venv\Scripts\python.exe python/zip_app.py
```

O script recusa sobrescrever uma entrega ou estágio existente: atualize `__version__` em `aebot/__init__.py` e os guias antes de gerar outra. O estágio fica em `python/build/<versão>`, sem apagar o anterior. O EXE usa PyInstaller, não um instalador. Leve `Abrir-AEBOT.exe`, `AEBOT.exe`, `_internal`, `resources`, licenças e guias juntos na primeira instalação. O script copia somente recursos permitidos, o perfil Asfalto e seus diagramas; modelos experimentais não entram. Depois da validação, [gere a atualização diferencial assinada](ATUALIZACOES-PYTHON-070.md), sem incluir a chave privada.

Para conferir o EXE gerado, execute pelo PowerShell com o caminho correto entre aspas:

```powershell
$exe = (Resolve-Path 'python/dist/AEBOT-Python-0.9.1/AEBOT.exe').Path
$relatorio = Join-Path (Get-Location) 'python/artifacts/exe-check.json'
Start-Process -FilePath $exe -ArgumentList ('--check --report "' + $relatorio + '"') -WindowStyle Hidden -Wait
Get-Content $relatorio
```

Esse diagnóstico abre e fecha o runtime Tk, confere os hashes, faz uma análise lexical e outra com modelo real, confere a montagem da interface e o logo e verifica o formulário/leitura com feedback sintético em SQLite temporário, sem acessar o banco do usuário. Não salva conversa. A pasta `python/artifacts` precisa existir; ela já é criada pelo avaliador. Nunca apresente somente esse smoke test como homologação de qualidade.

Se eu finalizar os resultados do EXE depois de gerar a pasta, atualizo somente os guias e regenero o manifesto antes de criar o ZIP:

```powershell
$env:PYTHONPATH = 'python'
.\.venv\Scripts\python.exe -c "from package_app import OUTPUT, copy_guides, write_manifest; copy_guides(OUTPUT); print(write_manifest(OUTPUT))"
.\.venv\Scripts\python.exe python/zip_app.py
```

Não uso essa etapa para trocar binários ou modelo depois do teste. O ZIP confere cada hash e a ausência de arquivos extras antes de compactar, e verifica o CRC após gerar.

Feedback fica fora da pasta distribuída, em `%LOCALAPPDATA%\AEBOT\Python\feedback.sqlite3`. Os testes da janela usam um diretório temporário separado; não escrevem no banco do usuário. Não há métricas persistentes. Não incluo feedbacks, banco local ou relatórios com conversas no pacote.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
