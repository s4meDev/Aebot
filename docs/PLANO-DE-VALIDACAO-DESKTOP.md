# Plano de validação do desktop

Situação revisada em 01/10/2026: extração de evidências parcialmente implementada, diagnósticos e registro de avaliações corrigidos. O runtime assinado da Unsloth restabeleceu a medição real: primeira rodada de 12 casos teve 11 acertos e duas saídas inválidas. A geração foi reforçada para exigir citações. Falta assinatura do próprio AEBOT, validação completa da IA e instalação nos notebooks. Este roteiro complementa o [Kanban conferido contra o código](KANBAN.md), que mantém os 16 cartões do Word, as estimativas originais e as diferenças de implementação.

## O que já existe

- Aplicativo Electron isolado, runtime llama.cpp gerenciado e Qwen local, sem contingência de nuvem.
- Motor compartilhado, interpretação validada por trechos e regras versionadas.
- Pacote Windows com Setup e GGUF, verificação de integridade e importação de regras.
- Feedback voluntário e métricas locais, com exportação explícita.
- Testes de código, smoke do aplicativo e avaliação de modelo com salvamento por caso.
- Guias de execução e manutenção, com créditos do projeto preservados no README.

## Trabalho em ordem de prioridade

| Etapa | Situação | Evidência necessária para concluir |
| --- | --- | --- |
| Conferir o Kanban da gestão | Comparação registrada | Consulte `KANBAN.md`; nenhum cartão foi declarado homologado ou implantado. |
| Restabelecer a inicialização local | Executado com runtime assinado | Qwen carregou e respondeu nesta máquina; confirmar no Latitude e em instalação limpa. Certificado do AEBOT permanece necessário para distribuir o novo Setup. |
| Evoluir para fatos nativos no motor | Entrada direta implementada; validação em andamento | `evaluateFacts` substitui a reavaliação de texto canônico. Falta ampliar o contrato para uma ficha independente de evidências, mantendo a base única e conferindo divergências do modelo real. |
| Validar o gabarito de 100 casos | Pendente de referência operacional | Confirmar decisão, fatos, regras e orientação esperada; resolver ambiguidades e hipóteses. |
| Avaliar o modelo no corpus completo | Em validação por amostras | Rodada completa com versões e perfil identificados, revisão de todas as divergências. |
| Medir no Latitude 3420 | Pendente de acesso ao equipamento | Tempos e RAM com sistemas corporativos abertos; comparar modo direto e experimental. |
| Corrigir falhas semânticas | Em andamento | Casos novos e cegos, sem cadastrar frases de teste como regra para maquiar resultados. |
| Testar instalação e atualização | Pendente de ambiente limpo/TI | Testar em pelo menos três perfis de notebook, sem internet, preservando regras e feedback. |
| Preparar distribuição confiável | Pendente de TI | Canal de entrega, assinatura/liberação, versão e hashes conferidos. |
| Rodar piloto de 5–10 pessoas | Não liberado para uso amplo | Aceite operacional, suporte definido e exemplos anonimizados revisados. |
| Escalar até 60 notebooks | Após o piloto | Qualidade e desempenho aceitos formalmente pelos responsáveis. |

## Critérios antes de avançar

Não use apenas o número de decisões corretas. Confira também se o motor usou a evidência certa, se a resposta foi útil, se uma hipótese foi reconhecida como hipótese e se perguntas pendentes foram aproveitadas na continuação.

Registre separadamente aprovações indevidas, reprovações esperadas não recomendadas, regras aplicadas incorretamente, perguntas repetidas, respostas sem orientação e demora excessiva. Divergências críticas devem ser resolvidas ou explicitamente tratadas pelo responsável antes de liberar o piloto.

Na primeira rodada de [28/09](STATUS-DESKTOP-2026-09-28.md), 10 de 12 casos tiveram o resultado esperado. Experimentos posteriores no recorte de seis casos chegaram a 5/6 no modo direto e 4/6 com raciocínio limitado a 128 tokens, usando configurações diferentes. Com o runtime assinado, a primeira rodada iniciada em 29/09 atingiu 11/12. São amostras repetidas, sem comparação controlada. O [relatório atual](STATUS-DESKTOP-2026-10-01.md) registra a correção do contrato e a validação seguinte; esses resultados não homologam o corpus inteiro.

O Kanban sugere média de até 20 segundos e concordância acima de 90% no primeiro ciclo, a confirmar com a coordenação. Antes de escalar, exige nenhum erro crítico aberto em regras de Reprovado, gabarito de pelo menos 100 perguntas, três perfis de instalação e suporte definido. A amostra direta de 25/09 teve média geral de cerca de 24 segundos nesta máquina, portanto ainda não demonstra o atendimento à meta de tempo.

O pedido de logs com perguntas presente no prompt anexo conflita com a política vigente de não persistir conversas. Não implementar essa coleta sem decisão explícita sobre finalidade, campos, retenção e acesso.

A amostra de 22/09 teve 6/6 resultados esperados no modo experimental, mas somente dois casos precisaram do modelo e levaram cerca de dois minutos. Esse resultado não representa a qualidade geral nem o desempenho do Latitude. O perfil padrão continua sendo direto; não há promoção automática de configuração.

## Como registrar uma rodada

Use o [guia de execução](EXECUTAR-E-TESTAR.md#4-avaliar-a-ia-real). Guarde o relatório JSON e anote, fora das conversas, quais sistemas corporativos estavam abertos, qual cenário foi testado e quem revisou o resultado.

Os relatórios técnicos identificam corpus/modelo e configuração de hardware sem nome do usuário ou computador. Eles não medem pico de memória do runtime e não contêm a resposta natural completa. Essa qualidade deve ser revisada de forma supervisionada com casos sintéticos, sem transformar chats reais em logs.

## Manutenção dos documentos

Atualize este plano quando houver evidência de conclusão. Preserve relatórios datados como histórico. Atualize o README apenas com capacidades verificadas, mantenha os créditos de Pedro Lucas Botelho no final e não apresente serviços ainda sem regras como prontos para análise.
