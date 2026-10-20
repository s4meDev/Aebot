# Feedback no AEBOT Python

## Enviar e ler

1. Escolho o serviço e clico em **Enviar feedback**, abaixo do chat.
2. Seleciono o tipo e descrevo o problema. Posso escrever também a orientação que esperava.
3. Clico em **Salvar feedback neste PC**.
4. Abro **Feedbacks salvos** para ler ou buscar por assunto, serviço e categoria.

Só salvo o que foi escrito nesse formulário, o serviço selecionado e as versões do aplicativo/base. Não anexo pergunta, resposta ou histórico automaticamente. Não incluo nome de cliente, endereço, matrícula ou número de OS. Para relatar um erro, descrevo a situação sem identificar pessoas.

## Reunir feedbacks de outros computadores

1. O analista abre **Feedbacks salvos → Exportar JSON**.
2. Envia esse arquivo ao responsável, por um canal autorizado.
3. No meu AEBOT, abro **Feedbacks salvos → Importar JSON** e escolho o arquivo recebido.
4. Os relatos passam a aparecer na minha lista. Importar o mesmo arquivo novamente não duplica registros.

O JSON contém os textos escritos no formulário. Compartilho apenas com quem deve lê-los. Não existe envio pela internet dentro do aplicativo, painel central ou conta de analista nesta versão. Qualquer pessoa com acesso ao perfil Windows pode ler o banco; ele não é criptografado.

## Onde ficam e o que acontece ao atualizar

O banco fica em `%LOCALAPPDATA%\AEBOT\Python\feedback.sqlite3`, no perfil do usuário Windows. Esse caminho também aparece na janela de leitura. Atualizar ou trocar a pasta do aplicativo não o apaga; outro usuário/PC tem seu próprio banco. Faço backup usando **Exportar JSON**, não copiando um SQLite aberto.

A conversa continua somente em memória. Nenhum contador de análises ou tempo é persistido. Feedback não altera regra, não treina o modelo e não confirma que a sugestão recebida esteja correta: reviso, transformo em caso sintético de teste e só então aprovo uma mudança.

Limites: descrição até 6.000 caracteres, resposta esperada opcional até 4.000. Cada lote importável/exportável aceita até 10 MB e 10.000 registros; um lote maior é recusado sem apagar o banco. A tela mostra até 500 resultados por busca, mas a exportação inclui todos os registros dentro desses limites. Se crescer além disso, preciso implementar exportação fracionada antes de consolidar o lote. IDs conflitantes ou arquivo inválido cancelam a importação inteira.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
