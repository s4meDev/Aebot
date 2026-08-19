# Base de conhecimento das ITs

Este documento registra como os materiais operacionais recebidos em 14/08/2026 foram usados no AEBOT. Ele não substitui as regras de `src/data/rulesStore.json`.

## Princípio de análise

Para o serviço original, o analista deve conseguir acompanhar a mesma execução em quatro pontos:

1. contexto e local correto;
2. condição inicial ou necessidade;
3. execução e método utilizado;
4. resultado final.

Cada **Adicional Executado** ou **Desdobro Executado** é tratado como outro serviço realizado e precisa de sua própria cadeia de evidências. Um **Adicional Posterior** precisa mostrar o motivo objetivo do retorno, sem ser apresentado como algo já executado.

Essa exigência geral orienta a análise, mas não cria automaticamente uma conclusão oficial. A conclusão só existe quando uma regra classificatória cadastrada define `severity`.

## Materiais incorporados

- Comercial: análise de corte e pós-corte, corte, religação e vistoria pós-corte.
- Manutenção: implantação de ligação, reparos de cavalete, ramal, rede de água e rede de esgoto, extensão e interligação de rede.
- Operação: verificação de falta de água.
- Repavimentação: reaterro de valas, calçada, asfalto e concreto.

## Limites importantes

- Padrões de execução de campo foram cadastrados como orientação quando a IT não definiu resultado oficial.
- Indícios críticos aparecem com `attentionLevel`, mas isso não autoriza a IA a escolher uma conclusão.
- Regras próprias do Reparo de Cavalete continuam específicas desse serviço.
- Medição de repavimentação em formato não aceito foi cadastrada como `Não Conforme`, pois os procedimentos determinam explicitamente esse registro.
- Reparo de Ramal compartilha as conclusões de ausência de etapas do Reparo de Cavalete, sem exigir chassi ou hidrômetro. Quando houver abertura de asfalto, calçada ou bloco, a análise confere reaterro e recomposição; em Ramal Terra, confere reaterro e finalização do solo.
- Serviços ainda sem conteúdo suficiente permanecem com `analysisStatus: "rules_pending"`.

Para manter ou ampliar a base, siga `docs/COMO-EDITAR-REGRAS.md`.
