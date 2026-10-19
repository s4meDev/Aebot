# Como baixar e abrir o AEBOT em outro computador

Esta é a versão **Python 0.1.1**, focada em **Repavimentação Asfalto**. O pacote já leva o programa, o Python e o modelo local. Não precisa instalar ferramentas, configurar servidor ou cadastrar chave de IA.

## 1. Baixar

No computador em que vou usar o AEBOT, abro este link:

**[Baixar AEBOT-Python-0.1.1.zip](https://github.com/s4meDev/Aebot/releases/download/python-v0.1.1-prototipo/AEBOT-Python-0.1.1.zip)**

O arquivo tem aproximadamente **495 MB**. Preciso de internet para baixar, mas as análises funcionam offline depois de extrair o pacote.

Se o download direto não abrir, entro na [página do protótipo](https://github.com/s4meDev/Aebot/releases/tag/python-v0.1.1-prototipo), procuro **Assets** e seleciono **AEBOT-Python-0.1.1.zip**.

**Não escolho “Source code (zip)”**: esse é o código para desenvolvimento e não contém o aplicativo pronto nem o modelo.

Também posso enviar o mesmo ZIP pelo WhatsApp, como **Documento**, ou copiar por pendrive. Não preciso levar a pasta inteira do projeto.

## 2. Extrair e abrir

1. Localizo `AEBOT-Python-0.1.1.zip` na pasta Downloads.
2. Clico com o botão direito e escolho **Extrair Tudo**.
3. Escolho uma pasta em Documentos e aguardo terminar a extração.
4. Abro a pasta `AEBOT-Python-0.1.1` extraída.
5. Dou dois cliques em **AEBOT.exe** e aguardo aparecer **IA local pronta**.

Não abro o EXE de dentro do ZIP. Mantenho as pastas `_internal` e `resources` ao lado dele: elas fazem parte do programa. Se quiser um atalho, crio um atalho do EXE; não movo apenas o EXE para a área de trabalho.

O pacote foi gerado para **Windows de 64 bits**. O Latitude com 16 GB é um alvo de teste, não uma garantia de desempenho já comprovada. Reservo cerca de 2 GB livres para o ZIP e a pasta extraída; o uso de RAM e a velocidade dependem da máquina e dos outros programas abertos.

## 3. Usar

1. Seleciono a faixa de área de Repavimentação Asfalto.
2. Descrevo o que observei na OS. O programa interpreta meu relato; não analisa fotos diretamente.
3. Se ele perguntar o tipo de equipe, respondo **interna** ou **terceirizada**.
4. Confiro a orientação e as regras citadas antes de concluir a análise.
5. Clico em **Novo caso** antes de analisar outra OS.

Fechar a janela descarta a conversa. Esta versão ainda não guarda histórico nem oferece as telas de feedback e administração do aplicativo antigo.

## Se não abrir

- Se aparecer “IA local pronta” e depois houver dúvida na resposta, descrevo melhor o fato ou começo um Novo caso.
- Se faltar arquivo ou modelo, extraio novamente o ZIP inteiro em outra pasta, sem misturar com a versão antiga.
- Se o Windows bloquear, guardo uma captura com a mensagem completa. Este EXE **não tem assinatura digital própria**. Não desativo antivírus, SmartScreen ou políticas da empresa para tentar executá-lo.
- A execução já foi verificada na máquina de desenvolvimento, mas ainda preciso validar a cópia no Latitude e em máquinas limpas.

## O que esperar deste protótipo

Nos testes registrados, 66 de 69 cenários foram atendidos; três ainda pedem esclarecimento. Não é uma garantia de 100% de acerto. O maior tempo de análise medido naquelas rodadas foi 2,38 segundos com o modelo carregado; a abertura e o desempenho em outro computador podem ser diferentes.

O pacote Python é separado do antigo `2.22.1`. Não preciso desinstalar a versão antiga para testar esta pasta, mas evito deixar as duas IAs abertas ao mesmo tempo, disputando memória.

## Para quem vai continuar o desenvolvimento

O código está no [repositório do AEBOT](https://github.com/s4meDev/Aebot), na branch `main`. O commit `6513992` contém a implementação Python. O guia [Executar Python](docs/EXECUTAR-PYTHON.md) explica dependências, regras, testes e geração do EXE. Clonar o Git não baixa os modelos nem o pacote portátil; para apenas usar, prefiro o link do ZIP acima.

### Conferência opcional do download

No PowerShell, dentro da pasta Downloads:

```powershell
Get-FileHash -LiteralPath '.\AEBOT-Python-0.1.1.zip' -Algorithm SHA256
```

O resultado deve ser:

```text
A98D816D190D201C08609EBA4991C6F60E906BCFC673BC299130FF9E3C6E430D
```

Esse hash confere os bytes do download; não substitui assinatura digital nem comprova a qualidade das respostas.

---

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
