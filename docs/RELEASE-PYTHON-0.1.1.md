# AEBOT Python 0.1.1 — protótipo de Repavimentação Asfalto

Pacote portátil Windows x64, separado da versão Electron 2.22.1.

## Download e uso

1. Baixe **AEBOT-Python-0.1.1.zip** nos Assets desta página, não “Source code”.
2. Extraia tudo e abra **AEBOT.exe** dentro da pasta extraída.
3. Aguarde “IA local pronta” e selecione a faixa de área do Asfalto.

Não precisa instalar Python, informar chave ou configurar servidor. O modelo acompanha o pacote e a análise funciona offline. Não mova somente o EXE: `_internal` e `resources` precisam ficar junto dele.

O documento **COMO-BAIXAR-EM-OUTRO-PC.md**, também nos Assets, contém o passo a passo completo. O ZIP contém um `LEIA-ME.txt`.

## Escopo e validação

- Interface e motor em Python, regras compartilhadas em JSON e interpretação local ONNX.
- Foco nas duas faixas de Repavimentação Asfalto.
- 28 testes Python e 872 testes do legado aprovados, além de typecheck e build.
- 50/53 casos anteriores e 16/16 cenários adicionais atendidos; três casos ainda pedem esclarecimento.
- Maior tempo de análise registrado nessas rodadas: 2,38 segundos com modelo carregado; não inclui abertura nem garante o mesmo tempo em outra máquina.
- EXE iniciado e verificado na máquina de desenvolvimento, incluindo inferência real. Validação no Latitude e em máquina limpa ainda pendente.

É um protótipo, sem garantia de 100% de acerto. A interface Python ainda não tem feedback, histórico persistente ou administração. Ela interpreta o relato do analista, não imagens.

O EXE **não possui assinatura digital própria**. Não desative controles do Windows se ele for bloqueado; registre a mensagem para diagnóstico.

SHA-256 do ZIP:

```text
A98D816D190D201C08609EBA4991C6F60E906BCFC673BC299130FF9E3C6E430D
```

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
