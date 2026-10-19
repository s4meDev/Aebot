# Como executar o AEBOT Python

## Só quero usar

O [guia de download em outro computador](../COMO-BAIXAR-EM-OUTRO-PC.md) contém o link do ZIP completo no GitHub e o passo a passo sem ferramentas de desenvolvimento. Não use “Source code (zip)” para instalar: ele não contém EXE nem modelo.

1. Abra `python/dist/AEBOT-Python-0.1.1.zip` e extraia tudo.
2. Entre na pasta extraída e abra `AEBOT.exe`.
3. Aguarde “IA local pronta”, escolha a faixa de área de Asfalto e descreva a OS.
4. Se ele perguntar o tipo de equipe, responda “interna” ou “terceirizada”.
5. Para outra OS, clique em **Novo caso**. Fechar a janela também descarta a conversa.

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

## Testes e verificação

```powershell
$env:PYTHONPATH = 'python'
.\.venv\Scripts\python.exe -m unittest discover -s python/tests -v
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

O script recusa sobrescrever uma entrega existente: atualize a versão/caminho no script, no pacote Python e no guia antes de gerar outra. O EXE usa PyInstaller, não um instalador. Leve `AEBOT.exe`, `_internal`, `resources`, licenças e guias juntos. O script copia somente recursos permitidos; modelos experimentais não entram.

Para conferir o EXE gerado, execute pelo PowerShell com o caminho correto entre aspas:

```powershell
$exe = (Resolve-Path 'python/dist/AEBOT-Python-0.1.1/AEBOT.exe').Path
$relatorio = Join-Path (Get-Location) 'python/artifacts/exe-check.json'
Start-Process -FilePath $exe -ArgumentList ('--check --report "' + $relatorio + '"') -Wait
Get-Content $relatorio
```

Esse diagnóstico abre e fecha o runtime Tk, confere os hashes e faz uma análise lexical e outra com modelo real. Não salva conversa. A pasta `python/artifacts` precisa existir; ela já é criada pelo avaliador. Nunca apresente somente esse smoke test como homologação de qualidade.
