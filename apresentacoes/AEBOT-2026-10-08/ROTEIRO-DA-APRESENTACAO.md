# Apresentação do AEBOT

Preparei 12 slides para uma apresentação de aproximadamente 10 minutos, seguida da demonstração. O PowerPoint tem notas do apresentador em cada slide. Os textos e a tabela são editáveis. O fundo e o logotipo vêm da referência Aegea enviada.

## Antes de apresentar

1. Levo a pasta completa do protótipo 2.22.1 para o disco local do Latitude. Não copio apenas o EXE e não abro dentro do ZIP.
2. Conecto o notebook à tomada e mantenho uma única instância do AEBOT aberta.
3. Testo a abertura antes da reunião e confiro se a IA está pronta nas configurações. Se o Windows bloquear, registro a mensagem e não altero as proteções.
4. Seleciono Repavimentação Asfalto na faixa de área correta. Uso casos sintéticos, sem dados de clientes.
5. Deixo o PDF disponível como alternativa para mostrar os slides. O slide 9 já tem uma captura da interface.

O passo a passo completo para o notebook fica em [Instalar no Latitude](../../docs/INSTALAR-NO-LATITUDE.md).

## O que quero explicar

- **Slides 1 e 2:** por que criei o projeto. Os 40 analistas e mais de 3.000 OS/dia descrevem a operação, não uma capacidade comprovada do AEBOT.
- **Slides 3 a 5:** como o analista conversa com o assistente, como as regras sustentam a orientação e quais são as três conclusões oficiais. A conferência humana continua necessária.
- **Slides 6 e 7:** exemplos de Asfalto e a diferença entre equipe interna e terceirizada quando falta aferição no serviço original.
- **Slides 8 e 9:** aplicativo offline e interface atual. O analista descreve as evidências. O AEBOT não lê fotos automaticamente nem altera a OS.
- **Slides 10 e 11:** resultado técnico, demora ainda existente e proposta de piloto supervisionado. Os testes não substituem homologação operacional.
- **Slide 12:** transição para a demonstração no Latitude.

## Minha demonstração

### Primeiro caso

Seleciono Repavimentação Asfalto e envio:

> Sem foto depois.

Confiro se recomenda **Reprovado**, cita a regra da etapa final e apresenta orientação coerente.

### Segundo caso

Clico em **Iniciar novo caso** e envio:

> A OS de repavimentação está sem aferição da vala.

Espero a pergunta sobre o tipo de equipe. Respondo:

> interna

Confiro **Não Conforme** com orientação de gerar retrabalho. Esse exemplo trata da OS original, não de um Adicional Executado nem da aferição da OS de origem.

Se houver tempo, inicio outro caso com a mesma falta e respondo **terceirizada**. A recomendação deve ser **Reprovado**.

Não misturo exemplos independentes no mesmo caso. Confiro os fatos, as regras e a orientação, além do rótulo final.

## Como falo das limitações

A rodada técnica passou 51 casos sintéticos de Asfalto, dos quais 19 usaram a IA. A mediana desses casos com IA foi 17,7 segundos no PC de desenvolvimento. No teste posterior do EXE, uma interpretação levou cerca de 2 minutos e 12 segundos. Esses números não medem o Latitude.

O EXE abriu em uma nova tentativa no PC de desenvolvimento, mas houve bloqueios anteriores. O AEBOT ainda não tem assinatura própria nem homologação para distribuição ampla. Não prometo que qualquer máquina permitirá executar ou que todas as perguntas terão respostas em poucos segundos.

Se a demonstração demorar, explico o que está sendo testado e mostro a captura do slide 9. Não apresento uma resposta previamente preparada como se fosse uma execução ao vivo.

Meu próximo passo é medir no Latitude e validar o piloto com 5 a 10 analistas antes de ampliar o uso.

## PowerPoint e Canva

No PowerPoint, abro `AEBOT_Apresentacao_Projeto_Final.pptx` e uso o Modo do Apresentador para consultar as notas. O PDF é uma alternativa de exibição, sem edição.

Para usar no Canva, importo o PPTX pelo recurso de importação de arquivos da minha conta. Depois confiro todas as páginas, principalmente fontes, tabela e quebra de linhas. Esta entrega é um arquivo editável, não um projeto já publicado na minha conta do Canva. Mantenho o PPTX como referência das notas caso a importação não as preserve.

Projeto idealizado e desenvolvido por **Pedro Lucas Botelho**.
