# AEBOT — decisões técnicas permanentes

- O produto é um Assistente de Análise, não um chatbot genérico. Respostas devem ser curtas, objetivas e fundamentadas apenas nas regras cadastradas.
- As únicas conclusões oficiais são `Conforme`, `Não Conforme` e `Reprovado`. Ausência de regra suficiente produz `decision: null` e validação humana; nunca use decisão padrão para aprovar.
- Regras específicas de serviços pertencem exclusivamente a `src/data/rulesStore.json`. O motor TypeScript deve permanecer genérico, sem IDs, textos ou heurísticas de um serviço.
- Matching usa normalização e tokens inteiros. Menção isolada, palavra interrogativa ou conhecimento geral não comprovam ocorrência.
- A avaliação determinística decide; providers de IA apenas humanizam a justificativa e não podem alterar a decisão nem inventar regras.
- Toda avaliação usa o `serviceId` realmente selecionado. IDs ausentes ou inválidos geram erro controlado, sem fallback para outro serviço.
- Preserve React + TypeScript estrito + Vite e compatibilidade Chrome Manifest V3. Não versione chaves; mantenha provider substituível.
- Mudanças no motor exigem testes Vitest, typecheck e build antes da entrega.
