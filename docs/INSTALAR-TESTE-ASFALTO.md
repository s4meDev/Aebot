# AEBOT — instalar e começar a usar

Entrega para testes de **16/11/2026** · Aplicativo **0.9.1** · Repavimentação Asfalto

## Só preciso deste ZIP

Uso **AEBOT-Instalar-0.9.1-Testes-16-11-2026.zip**. Ele já leva o instalador, a IA local, as regras e estes manuais. Posso enviar pelo WhatsApp como **Documento** ou copiar por pendrive. Não uso o “Source code” nem o protótipo antigo 2.22.1 do GitHub.

## Instalar em cada computador

1. Copio o ZIP inteiro para o computador em que vou usar.
2. Clico com o botão direito no ZIP → **Extrair Tudo**. Espero terminar.
3. Na pasta extraída, abro **Instalar-AEBOT.exe**. Não abro de dentro do ZIP.
4. Clico em **Instalar AEBOT** e aguardo a mensagem de conclusão. A janela pode ficar conferindo os arquivos e testando a IA por algum tempo; não a fecho durante essa etapa.
5. Clico em **Abrir AEBOT**. Espero **IA local pronta**, escolho até ou acima de 1 m² e escrevo minha dúvida ou relato.

Não preciso instalar Python, cadastrar chave, informar URL, abrir servidor ou pedir elevação de administrador. A instalação usa meu perfil Windows. Políticas do computador ainda podem impedir o EXE ou a escrita; o instalador não as altera.

Mantenho **AEBOT-completo-0.9.1.aebot-update** ao lado do instalador até terminar. Não extraio esse arquivo: o instalador confere sua assinatura e seus bytes. Nenhum componente é baixado.

**Requisitos:** Windows 10/11 de 64 bits atualizado; notebook com 16 GB de RAM recomendado para estes testes; cerca de **4 GB livres** para ZIP, extração, instalação e margem. O programa é local e o desempenho depende do processador, memória e programas abertos.

## Abrir nos próximos dias

Depois de instalar, clico em **Abrir pasta instalada**. O ponto de entrada é **Abrir-AEBOT.exe**.

O destino padrão é `%LOCALAPPDATA%\AEBOT\Application`. Posso colar esse caminho na barra de endereço do Explorador de Arquivos. Se escolhi outro destino no instalador, uso o caminho mostrado por ele.

Para criar um atalho, clico com o botão direito em **Abrir-AEBOT.exe** → **Mostrar mais opções**, se aparecer → **Enviar para → Área de trabalho (criar atalho)**. Nas próximas vezes, abro por esse atalho. Não copio apenas AEBOT.exe e não removo `resources` ou `_internal` da instalação.

Após instalar, não preciso manter a pasta extraída do instalador para analisar. Posso guardar o ZIP como cópia da entrega. A pasta instalada é outra; não a apago.

## Já tenho AEBOT instalado

Este instalador é para **primeira instalação** e não sobrescreve pastas existentes. Se avisar que o destino já existe, abro **Abrir-AEBOT.exe** dessa instalação. Para atualizar, uso **Atualizar → Pacote manual** com o diferencial da versão instalada, ou o canal da empresa depois de publicado. Para uma instalação de teste separada, uso **Escolher outra pasta** e escolho uma pasta que receberá uma nova subpasta `AEBOT`.

Não extraio arquivos por cima de outra versão. Os feedbacks permanecem no perfil Windows, separados da instalação. Não existe limpeza automática de versões ou de preparações interrompidas.

## Usar sem misturar os casos

- Descrevo o que conferi na OS. O AEBOT interpreta **texto**; não lê fotos nem consulta Field/SCAE.
- Quando pedir equipe, frente ou outro detalhe, respondo na mesma conversa ou escolho a opção que realmente confirmei. Não preciso repetir tudo.
- Para corrigir uma informação: **“Corrigindo: …”**. Para explicar um trecho ambíguo: **“Quis dizer: …”**.
- Posso consultar uma regra ou simular com **“Se…”**, sem alterar os fatos da OS. Para sair da simulação: **“Voltando ao caso real: …”**.
- Para outra OS, clico em **Novo caso**. Fechar o app descarta a conversa.
- **Ver fundamentos** mostra os critérios e trechos usados. **Regras e fluxo** abre o catálogo e o diagrama offline.
- Confiro a recomendação antes de concluir no sistema. O aplicativo não altera OS, formulário ou desdobro automaticamente.

Faço a conferência descrita em **01-ROTEIRO-DE-TESTE.md** antes de usar nas dúvidas do dia. Ela inclui falta de aferição, mudança de equipe, exceção e consulta sem classificação.

## Registrar um problema

Uso **Enviar feedback** e escrevo, sem identificar cliente ou OS: o relato que fiz, o que o assistente respondeu e o que deveria orientar. O formulário começa vazio e não anexa o chat. Ele fica **salvo somente neste computador**.

No fim dos testes, abro **Feedbacks salvos → Exportar JSON** e envio o arquivo ao responsável por canal autorizado. Ele reúne os relatos usando **Importar JSON**. Detalhes em **02-FEEDBACK.md**. Não incluo nomes de clientes, endereços, matrículas ou números de OS.

## Se não funcionar

| Situação | O que faço |
| --- | --- |
| Falta o pacote ou arquivo diferente | Copio o ZIP completo novamente e extraio em outra pasta. Não misturo entregas. |
| Destino já existe | Uso a instalação existente/atualizador ou escolho uma pasta nova. Nada é sobrescrito. |
| Demora na primeira abertura | Espero o estado de preparação. Evito abrir duas instâncias; fecho somente a versão antiga que eu estava usando. |
| Teste de instalação falhou | Guardo a mensagem. A pasta final não é liberada e a preparação fica preservada para diagnóstico. Não copio arquivos dela manualmente. |
| Sem espaço ou sem permissão | Confiro espaço e escolho uma pasta local em que meu usuário possa gravar. Não executo como administrador por tentativa. |
| Windows bloqueou o EXE | Guardo a mensagem completa. Não desativo antivírus, SmartScreen, AppLocker ou outras políticas. Esta entrega ainda não tem certificado próprio de EXE. |
| Resposta errada ou sem entendimento | Não uso essa orientação para fechar a OS; registro feedback e confiro com o responsável. |

A análise é offline e não tem cota de API. A instalação e o modelo foram testados no computador de desenvolvimento, mas isso não garante liberação em todas as máquinas. A assinatura interna do pacote **não é Authenticode** nem elimina bloqueios do Windows. Não prometo 100% de acerto ou tempo igual em qualquer computador.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
