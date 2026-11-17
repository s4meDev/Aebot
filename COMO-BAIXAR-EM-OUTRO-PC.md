# Como levar o AEBOT para outro computador

## Mais simples para os testes de 16/11

Baixo **[AEBOT-Instalar-0.9.1-Testes-16-11-2026.zip](python/dist/AEBOT-Instalar-0.9.1-Testes-16-11-2026.zip)**, envio inteiro como Documento e extraio tudo no outro computador. Abro **Instalar-AEBOT.exe → Instalar AEBOT → Abrir AEBOT**. O modelo e as regras já estão incluídos; não preciso de internet, servidor, chave nem da pasta corporativa sincronizada.

O `00-COMECE-AQUI.md` dentro desse ZIP é o [manual simples](docs/INSTALAR-TESTE-ASFALTO.md). O destino padrão é `%LOCALAPPDATA%\AEBOT\Application`; depois uso `Abrir-AEBOT.exe` da pasta instalada ou crio um atalho dele. Se já houver instalação nesse destino, não a sobrescrevo: uso o atualizador ou escolho uma pasta nova de teste. A assinatura interna confere o pacote, não elimina eventual bloqueio do EXE pelo Windows.

## Pacote atualizado: Python 0.9.1

Na primeira instalação, uso **[AEBOT-Python-0.9.1.zip](python/dist/AEBOT-Python-0.9.1.zip)**. Ele reúne EXE, lançador, modelo, regras, diagrama e instruções. Não preciso baixar o antigo 2.22.1 nem arquivos separados de modelo. Os resultados desta entrega ficam em `RESULTADOS-TESTES.md` dentro da pasta. O roteiro curto está em `COMO-USAR.md`.

**Pasta da empresa:** depois de publicada e sincronizada, baixo `Instalar-AEBOT.exe`. Ele obtém o pacote e instala no meu perfil. No app, **Atualizar → Procurar atualizações → Atualizar agora** obtém a revisão compatível. Se não localizar a central, escolho uma vez a pasta AEBOT no Explorador. Veja [Distribuir na empresa](docs/DISTRIBUIR-EMPRESA.md). A publicação real ainda depende de copiar a central preparada para a biblioteca corporativa.

**Já uso uma versão anterior:** sigo [Como atualizar](docs/ATUALIZAR-AEBOT.md). A contingência manual aceita `.aebot-update` compatível, sem baixar o modelo igual novamente.

Posso enviá-lo pelo WhatsApp como **Documento**, copiar por pendrive ou compartilhar o arquivo inteiro. Não preciso enviar o código-fonte nem juntar partes. Os passos abaixo valem para a pasta completa gerada, não para “Source code (zip)” do GitHub.

Esta revisão é local. O [download público 0.1.1](https://github.com/s4meDev/Aebot/releases/tag/python-v0.1.1-prototipo) é uma versão anterior, não a entrega descrita aqui.

## Extrair e abrir

1. Na primeira instalação, baixo e copio `AEBOT-Python-0.9.1.zip` inteiro para o outro computador.
2. Clico com o botão direito e escolho **Extrair Tudo**.
3. Aguardo terminar e abro a pasta `AEBOT-Python-0.9.1`.
4. Dou dois cliques em **Abrir-AEBOT.exe**.
5. Aguardo **IA local pronta**, seleciono o serviço e escrevo o caso.

Não há ordem de instalação: só extraio e abro. O arquivo `00-COMECE-AQUI.txt`, dentro da pasta, repete o passo a passo. A primeira abertura pode levar mais tempo para conferir e carregar os arquivos; aguardo o estado **IA local pronta** antes de enviar.

Não abro o EXE de dentro do ZIP. Mantenho `_internal`, `resources`, licenças e guias ao lado dele. O pacote já contém o Python e o modelo; não preciso instalar ferramentas, configurar servidor, cadastrar chave ou manter internet para analisar.

O alvo é **Windows de 64 bits**. Reservo cerca de 2 GB livres para o ZIP e a pasta extraída. A velocidade depende do computador e dos programas abertos. Evito deixar a versão antiga e a nova com suas IAs abertas ao mesmo tempo.

## Usar

- Escolho até ou acima de 1 m² de Repavimentação Asfalto.
- Descrevo o que observei. O programa interpreta meu relato; **não lê as fotos**.
- Se ele perguntar equipe ou frente, respondo na mesma conversa.
- Para corrigir um dado, escrevo “Corrigindo: ...”.
- Para outra OS, clico em **Novo caso**.
- Em **Regras e fluxo**, consulto os critérios por categoria e abro o diagrama offline.
- Posso perguntar “Me explique a falta de aferição” para conhecer os caminhos. Isso não classifica uma OS. Uma hipótese com “Se...” também não altera os fatos do caso real.
- Confiro a orientação e as regras antes de concluir no sistema.

A conversa fica somente em memória. Fechar a janela a descarta. **Enviar feedback** salva apenas o formulário preenchido voluntariamente, sem anexar o chat. Em **Feedbacks salvos**, leio ou exporto um JSON para o responsável importar no próprio AEBOT. Veja [o guia de feedback](docs/FEEDBACK-PYTHON.md). O banco fica no perfil Windows, fora da pasta do aplicativo, e é preservado ao trocar de versão. Administração central e atualização de regras pela interface ainda não foram migradas. Não há métricas persistentes.

## Se não abrir

Se faltar arquivo ou modelo, extraio o ZIP inteiro novamente em uma pasta separada, sem misturar versões.

Se o Windows bloquear, guardo uma captura da mensagem completa. O protótipo **não tem assinatura digital própria**. Não desativo antivírus, SmartScreen, AppLocker ou políticas para fazê-lo executar. Python não elimina esse tipo de restrição.

O EXE é testado na máquina de desenvolvimento, mas isso não garante liberação ou desempenho igual em qualquer notebook.

## Limitações e manutenção

A [revisão 0.9.1](docs/REVISAO-PYTHON-090.md) explica o que melhorou, os tempos medidos e as perguntas que ainda falham. Não é uma garantia de 100% de acerto. O BGE associa o relato às regras; não é um modelo generativo equivalente ao ChatGPT. Use Ver fundamentos para conferir as regras e os trechos da última resposta. Para retomar a OS no meio de uma simulação, escreva “Voltando ao caso real: …”.

A pasta contém `LEIA-ME.txt` e `SHA256SUMS.txt`. Os hashes verificam os bytes dos arquivos; não substituem assinatura digital nem comprovam a qualidade da análise. Para executar pelo código, editar regras ou gerar outra versão, sigo [Executar Python](docs/EXECUTAR-PYTHON.md).

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
