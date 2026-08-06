# Entrada governada de regras

Este processo impede que uma frase solta vire decisão oficial sem rastreabilidade.

## Informações mínimas

- Serviço e identificador estável da regra.
- Cenário observado e conclusão oficial, quando houver.
- Orientação objetiva ao analista.
- Origem ou observação adicional, quando for útil para consulta futura.
- Exemplos reais anonimizados, incluindo formas informais de descrever o caso.
- Exceções e condições obrigatórias conhecidas.

Uma orientação que ensina como executar ou conferir o serviço, mas não define uma conclusão, deve ser cadastrada sem `severity`.

## Fluxo de alteração

1. Confirmar com o responsável qual cenário e conclusão devem ser cadastrados.
2. Editar somente `src/data/rulesStore.json`; nunca copiar a decisão para TypeScript.
3. Se houver documento ou observação útil, registrá-la opcionalmente em `sourceReferences`.
4. Cadastrar expressões equivalentes específicas da regra e exemplos informais.
5. Adicionar casos positivos e negativos em `src/data/regressionCases.json`.
6. Executar `npm run rules:audit`, `npm test`, `npm run typecheck` e `npm run build`.
7. Incrementar a versão da base quando o conteúdo entrar em uso.

## Critério de aceite

A regra só pode produzir uma conclusão quando os fatos mínimos estiverem representados nos dados e os testes demonstrarem que menções, hipóteses e negações não são tratadas como ocorrência real.
