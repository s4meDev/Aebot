# Como executar o AEBOT Python

## Só quero usar

Estado no checkpoint 0.3.0: código salvo; novo pacote ainda em validação/empacotamento. As instruções abaixo se aplicam depois de gerar e testar essa entrega. Não há anúncio de um ZIP 0.3.0 já disponível.

O [guia de transferência](../COMO-BAIXAR-EM-OUTRO-PC.md) explica o pacote local 0.3.0 e distingue a publicação anterior no GitHub. Não use “Source code (zip)” para instalar: ele não contém EXE nem modelo.

1. Abra `python/dist/AEBOT-Python-0.3.0.zip` e extraia tudo.
2. Entre na pasta extraída e abra `AEBOT.exe`.
3. Aguarde “IA local pronta”, escolha a faixa de área de Asfalto e descreva a OS.
4. Se ele perguntar o tipo de equipe, responda “interna” ou “terceirizada”.
5. Para outra OS, clique em **Novo caso**. Fechar a janela também descarta a conversa.
6. Use **Enviar feedback** para relatar um problema e **Feedbacks salvos** para consultar, exportar ou importar os relatos. Veja [como reunir feedbacks](FEEDBACK-PYTHON.md).

Não instale Python nem informe chave. Copie a pasta inteira, nunca só o EXE. O pacote não baixa componentes ao abrir. O modelo local não tem cota de API, mas depende da memória e CPU disponíveis. Não desative proteções do Windows se o aplicativo for bloqueado: guarde a mensagem para diagnóstico. Este protótipo ainda não tem certificado próprio.

## Vou desenvolver ou editar regras

Pré-requisitos: Windows x64, Python 3.12 com Tkinter; internet apenas para preparar dependências e modelo. No PowerShell, dentro da raiz do projeto:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python/requirements.txt
.\.venv\Scripts\python.exe python/prepare_model.py
.\.venv\Scripts\python.exe python/main.py
```

Usei Python 3.12.14 nesta rodada. `python/environment-tested.txt` registra todas as versões instaladas, inclusive dependências transitivas e ferramentas de build; `requirements.txt` contém apenas as dependências diretas de execução. O caminho do Python usado para criar o ambiente precisa continuar existindo enquanto desenvolver; o EXE distribuído não depende dele.

Regras: `src/data/rulesStore.json`. O campo opcional `semanticCriteria` descreve a condição de uma regra, não cadastra uma decisão diferente. A severidade, as condições obrigatórias, as exceções e a orientação continuam nos campos próprios. Não precisa recompilar pesos ao mudar regras; precisa validar a base e refazer os testes. O pacote distribuído usa uma cópia em `resources/src/data/rulesStore.json` e carrega a base novamente ao abrir.

Na base 2.18.0, `interpretation` declara escopos, objetos de registro e alternativas de equipe/frente/etapa/troca. `evaluation` liga uma regra ao fato, ao escopo e aos valores exigidos ou incompatíveis. `perStatement` evita aplicar o “antes” de uma oração ao “depois” de outra. Para regras assim anotadas, os valores ativos resolvem equipe/frente: não uso a equipe antiga concatenada na conversa como condição vigente. Mantenho os campos lexicais anteriores para compatibilidade com o legado. Veja [a revisão atual](REVISAO-INFORMAIS-FEEDBACK-2026-10-20.md).

## Testes e verificação

Para resultados atuais, consulte [a revisão 0.3.0](REVISAO-INFORMAIS-FEEDBACK-2026-10-20.md). A [comparação 0.2.0](REVISAO-PYTHON-2026-10-20.md) e a [auditoria anterior](AUDITORIA-ASFALTO-2026-10-20.md) permanecem como histórico. Passar nos testes de unidade não significa acertar todas as situações de linguagem livre.

```powershell
$env:PYTHONPATH = 'python'
.\.venv\Scripts\python.exe -m unittest discover -s python/tests -v
.\.venv\Scripts\python.exe python/audit_asphalt.py --suite full --repeat 3 --output python/artifacts/nova-rodada.json
.\.venv\Scripts\python.exe python/audit_asphalt.py --suite acceptance --repeat 3 --output python/artifacts/aceitacao-nova.json
.\.venv\Scripts\python.exe python/evaluate.py --output python/artifacts/corpus.json
.\.venv\Scripts\python.exe python/test_semantic.py
.\.venv\Scripts\python.exe python/test_app.py
.\.venv\Scripts\python.exe python/main.py --check
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

`evaluate.py` imprime divergências mesmo quando a execução termina normalmente; confira `passed` e cada linha do relatório, não apenas o exit code. Hipóteses são comparadas pela conclusão **condicional** (`scenarioDecision`), mantendo `decision: null`. Não use a mediana geral de casos lexicais como se fosse tempo só de IA.

## Gerar uma entrega nova

```powershell
.\.venv\Scripts\python.exe -m pip install -r python/requirements-build.txt
.\.venv\Scripts\python.exe python/package_app.py
.\.venv\Scripts\python.exe python/zip_app.py
```

O script recusa sobrescrever uma entrega existente: atualize `__version__` em `aebot/__init__.py` e os guias antes de gerar outra. O destino é derivado dessa versão. O EXE usa PyInstaller, não um instalador. Leve `AEBOT.exe`, `_internal`, `resources`, licenças e guias juntos. O script copia somente recursos permitidos; modelos experimentais não entram.

Para conferir o EXE gerado, execute pelo PowerShell com o caminho correto entre aspas:

```powershell
$exe = (Resolve-Path 'python/dist/AEBOT-Python-0.3.0/AEBOT.exe').Path
$relatorio = Join-Path (Get-Location) 'python/artifacts/exe-check.json'
Start-Process -FilePath $exe -ArgumentList ('--check --report "' + $relatorio + '"') -Wait
Get-Content $relatorio
```

Esse diagnóstico abre e fecha o runtime Tk, confere os hashes e faz uma análise lexical e outra com modelo real. Não salva conversa. A pasta `python/artifacts` precisa existir; ela já é criada pelo avaliador. Nunca apresente somente esse smoke test como homologação de qualidade.

Feedback fica fora da pasta distribuída, em `%LOCALAPPDATA%\AEBOT\Python\feedback.sqlite3`. Os testes da janela usam um diretório temporário separado; não escrevem no banco do usuário. Não há métricas persistentes. Não incluo feedbacks, banco local ou relatórios com conversas no pacote.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
