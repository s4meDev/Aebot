# Conferência do documento de Repavimentação Asfalto

12/11/2026 · Base 2.20.0 · Duas faixas de área

Li `Repavimentação Asfalto atualizado.txt` fornecido pelo responsável. SHA-256 do arquivo conferido: `14bee3f0f36b0a8efccd8837917a541e04bc7bd140340fc8c06b59f0c3e9a38a`.

A fonte operacional continua em `src/data/rulesStore.json`. O TXT e esta conferência não são carregados como um segundo motor. As confirmações posteriores do responsável prevalecem onde há conflito.

## Matriz de critérios

| Item do TXT | Critério vigente e suporte na base |
| --- | --- |
| 1.1 · Sem antes | Não Conforme — `RULE-ASF-FOTO-ANTES-01`. |
| 1.2 · Sem durante | Não Conforme — `RULE-ASF-FOTO-DURANTE-01`. |
| 1.3 e 11.1 · Sem antes e durante | Reprovado — `RULE-ASF-FOTOS-COMBINADAS-01`, sustentada pelas duas faltas independentes; não basta citar as etapas. |
| 1.4 · Sem depois | Reprovado — `RULE-ASF-FOTO-DEPOIS-01`. |
| 1.5 · Fotos ruins | Não Conforme — `RULE-ASF-FOTO-QUALIDADE-01`; não confundir qualidade com ausência da foto. |
| 2.1 · Sem origem | Não Conforme — `RULE-ASF-ORIGEM-01`; orientar conferência Field/SCAE e troca para 318033. O app não executa essa troca. |
| 2.2 · Origem sem aferição | `RULE-ASF-ORIGEM-AFERICAO-01` exige frente compatível; `RULE-ASF-ORIGEM-VCG-01` registra a exceção VCG. Sem frente, perguntar. A exceção não dispensa aferição do serviço atual. |
| 3.1 · Sem aferição atual | Retificação: interna = Não Conforme + Retrabalho (`RULE-PAV-AFERICAO-INTERNA-01`); terceira = Reprovado (`RULE-PAV-AFERICAO-TERCEIRA-01`). Sem vínculo, perguntar. |
| 3.2 · Metragem incoerente | Não Conforme — `RULE-ASF-MEDICAO-01`. |
| 3.3 · Trena impeditiva | Retificação confirmada em 03/11: interna = Não Conforme + Retrabalho (`RULE-ASF-TRENA-01`); terceira = Reprovado (`RULE-ASF-TRENA-TERCEIRA-01`). Exige impedimento de conferir a metragem; mera utilização de trena não é falha. Sem vínculo, perguntar. |
| 4.1 e 4.2 · Vala/local errado | Reprovado — `RULE-ASF-LOCAL-01`. |
| 5.1 · Reaterro/concreto encerrado como asfalto | Reprovado — `RULE-ASF-MATERIAL-01`; não confundir o concreto da origem com o material do asfalto atual. |
| 5.2 · Acabamento inadequado | Reprovado — `RULE-ASF-ACABAMENTO-01`; conferir resultado final, não uma etapa intermediária. |
| 6.1 · Duplicidade | Reprovado — `RULE-ASF-DUPLICIDADE-01`; exige conferência no Field/SCAE. Cancelamento é ação orientada, não quarta conclusão oficial. |
| 7.1 · Troca impossível | Reprovado — `RULE-ASF-TROCA-IMPOSSIVEL-01` / `RULE-PARAM-TROCA-IMPOSSIVEL-01`, conforme os fatos mapeados e suas condições. Não escolher código inadequado. |
| 7.2 · Troca possível | Não Conforme — `RULE-ASF-TROCA-01`; disponibilidade deve ser confirmada, não inferida do verbo “trocar”. |
| 8.1 · Formulário | Não Conforme — `RULE-ASF-FORMULARIO-01`. |
| 9.1 · Falta de adicional necessário | Não Conforme — `RULE-PARAM-GERAL-01`, com as orientações posteriores gerais do responsável. |
| 9.2 · Adicional incorreto | Não Conforme — `RULE-ASF-DESDOBRO-INDEVIDO-01`. |
| 9.3 · Adicional desnecessário | Não Conforme — `RULE-ASF-DESDOBRO-EXCESSO-01`. A necessidade precisa estar nas evidências. |
| 10.1 · EHS | Não Conforme — `RULE-ASF-EHS-01`. Um novo objeto (“sinalização”) não pode virar ausência de foto. |
| 11.2 · Múltiplas falhas | O serviço declara `most_severe_applicable`; reúno as regras realmente aplicáveis e a combinação de fatos, sem transformar um match fraco em reprovação. |
| Conforme | `RULE-ASF-CONFORME-01` exige declaração completa dos critérios; ausência de texto sobre falhas não prova que a OS foi conferida. |

## Diferenças deliberadas do TXT

1. **Itens 3.1 e 3.3:** o TXT antigo dizia Reprovado sem distinguir vínculo. As orientações posteriores diferenciam interna e terceirizada. Para trena impeditiva, o responsável reafirmou interna = Não Conforme + Retrabalho em 03/11/2026. Não reverto isso para “obedecer ao arquivo” e contradizer a confirmação mais recente.
2. **“Reprovado e Cancelado”:** preservo Reprovado como conclusão oficial e cancelamento como ação operacional a ser feita no sistema, após conferência. Não crio outra conclusão.
3. **Sem base/informação:** `decision: null` permanece possível; não vira Conforme automaticamente. Consulta e hipótese não classificam uma OS real.
4. **Adicional Executado:** as orientações posteriores do responsável distinguem retrabalho da equipe interna e retirada/lançamento no Posterior para terceira. Não aplico o critério da OS atual a outro escopo.

## Como verifico as respostas

`python/audits/document_cases.py` acrescenta 29 cenários por faixa, 58 no total, escritos com o gabarito do documento e das retificações. Confiro conclusão, regras e perguntas necessárias. A primeira rodada com modelo real passou em 58/58; eles também entram na auditoria completa desta entrega. Isso não equivale a testar todas as redações possíveis.

Conservo os gabaritos antigos e suas divergências. Uma consulta sobre duplicidade ainda cita a regra como consulta, enquanto o gabarito espera nenhuma; uma frase informal ambígua ainda pede esclarecer se falta foto ou execução, enquanto o gabarito antigo espera Não Conforme. Não escondo esses pontos nem anuncio assertividade universal de 100%.

O BGE relaciona linguagem às situações cadastradas. Ele não lê fotos e não é um modelo gerador como ChatGPT. A orientação precisa ser conferida na OS, principalmente quando o relato não distingue execução, registro, origem e adicional.

## Onde e como alterar

| Quero alterar | Arquivo / objeto |
| --- | --- |
| Regra, conclusão, exceção, orientação ou serviço aplicável | `src/data/rulesStore.json` → `RuleStore`. |
| Abreviação genérica | `src/data/languageAliases.json` → `Text`. |
| Negação, tokenização ou separação de oração | `python/aebot/text.py`. |
| Interpretação de relato sem duplicar negócio | `Extractor`, em `extraction.py`. |
| Condição, escopo ou contexto vigente | `CaseFacts`, em `facts.py`. |
| Avaliação e combinação determinística | `Engine`, em `engine.py`. |
| Continuação, consulta e hipótese | `Session`, em `session.py`. |
| Resposta curta sem alterar a avaliação | `response.py`; fundamentos completos em `evidence_ui.py`. |
| Fluxograma / mapa de manutenção | `AnalysisFlow` + `export_rulebook.py`; regenerar da fonte, nunca cadastrar decisão no desenho. |
| Distribuição e atualização | `UpdateChannel`, `ChannelClient`, `updates.py`, `publish_channel.py`. |

Após alterar regras: atualizar a versão da base, acrescentar gabarito e controles de negação/exceção/contexto, regenerar o fluxo, executar testes e auditoria real, gerar versão nova e publicar o pacote assinado. O diagrama ajuda uma IA de manutenção a localizar os arquivos; ele não a autoriza a inventar critérios nem muda o motor sozinho.

Projeto idealizado e conduzido por **Pedro Lucas Botelho Naus**.
