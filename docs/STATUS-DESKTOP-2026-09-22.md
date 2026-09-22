# Retomada do desktop — 22/09/2026

Status: validação técnica, sem liberação para produção.

## Alterações desta etapa

- O protocolo do modelo local agora referencia trechos numerados da pergunta. O modelo informa `sourceId`; o código recupera a citação literal correspondente e passa pelo mesmo `SemanticInterpreter` usado pelo núcleo compartilhado.
- IDs de regras são limitados pelo schema do catálogo recuperado. Citações inventadas, índices fora do intervalo e regras inexistentes não autorizam uma conclusão.
- Perguntas mantêm a interrogação e trechos com contraste são separados, sem cadastrar frases de teste como novas regras de negócio.
- Resposta inválida do modelo é identificada como `invalid_response` nos metadados, distinguindo-a de falha de conexão. Nenhuma conversa ou raciocínio é persistido na telemetria.
- A ferramenta de avaliação grava cada caso concluído e mantém o arquivo de cada rodada. A flag `--thinking` permite comparar o raciocínio limitado a 512 tokens; ela não altera automaticamente o aplicativo distribuído.

## Comparação com o modelo real

O protocolo por trechos, no modo direto, continuou com quatro acertos em seis casos da amostra (offset 66). Os dois casos de linguagem livre permaneceram sem a conclusão esperada. Os acertos desse grupo foram determinísticos; não são prova de qualidade semântica do Qwen.

A comparação do mesmo grupo com `--thinking` terminou com seis acertos em seis casos, conferindo também os grupos de fatos. Os dois casos que exigiram interpretação pelo modelo levaram 128.647 ms e 123.127 ms; os outros quatro foram resolvidos pelo motor determinístico em 3–8 ms. Portanto, não se trata de seis acertos independentes da IA, nem de uma estimativa de acurácia geral.

No segundo caso semântico, a orientação natural foi recusada pela validação (`fallbackReason: invalid_response`), mas a interpretação da ausência da etapa final sustentou corretamente a decisão determinística. Esse resultado ainda exige revisão da qualidade da resposta apresentada, além do rótulo final.

O relatório completo foi preservado em `desktop-release/evaluations/2026-09-22T17-19-34-611Z.json`, com `completed: true`. O modo experimental **não foi ativado no instalador**: o ganho nesta pequena amostra não justifica impor dois minutos de espera aos analistas sem avaliar os outros cenários e o hardware de destino.

Os 100 casos ainda exigem execução integral e validação de gabarito pelo responsável operacional. O teste com modelo não deve ser confundido com os testes automatizados de código. As medições nesta máquina não representam o desempenho do Latitude 3420 com os sistemas corporativos abertos.

## Como reproduzir

```powershell
npm run desktop:evaluate -- --offset=66 --limit=6
npm run desktop:evaluate -- --offset=66 --limit=6 --thinking
```

Compare os arquivos em `desktop-release/evaluations/`. Confira `completed`, `profile`, decisão, grupos de fatos, regras, contingência e duração. Acertar a classificação usando uma etapa indevida continua contando como divergência.

## Validação do código

- Vitest: 395 testes aprovados e 1 teste ignorado; 29 arquivos de teste aprovados.
- Typecheck: frontend, ferramentas, servidor, Worker e desktop sem erros.
- Build: extensão, servidor Node, Worker em dry-run (sem publicação) e Electron aprovados.
- Instalador 2.18.0 regenerado em 22/09, acompanhado do GGUF e de `SHA256SUMS.txt` em `desktop-release/`; runtime, licenças e hash do modelo conferidos pelo empacotamento. O Setup e o modelo precisam permanecer juntos para instalar.
- Aplicativo Electron real: renderer isolado, ponte IPC, catálogo com 36 serviços e análise determinística verificados; captura de tela inspecionada.
- Manifest V3 validado; auditoria da base 2.14.0 aprovada, com 77 regras. O catálogo ainda tem 8 serviços com regras pendentes e 6 nomes a confirmar.
- Nenhuma regra de negócio foi alterada nesta etapa. Os novos testes cobrem o protocolo por trechos e sua ligação com o motor compartilhado.

O build ainda emite aviso de depreciação de `inlineDynamicImports`, sem impedir a geração. Instalação/desinstalação em máquina limpa, assinatura corporativa, aprovação da TI e desempenho no Latitude continuam pendentes. O teste Electron executa o aplicativo compilado; não substitui um teste do instalador em uma máquina de analista.

Próximo passo: ampliar e repetir a avaliação em um conjunto não usado nos ajustes, medir no notebook corporativo e decidir o perfil de inferência antes do piloto operacional. O perfil direto continua sendo o padrão enquanto a comparação não justificar sua substituição.
