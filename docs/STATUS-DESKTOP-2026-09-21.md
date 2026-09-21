# Entrega técnica do desktop — 21/09/2026

Status: protótipo offline para validação supervisionada, ainda não homologado para a operação.

## O que está funcionando

- Aplicativo Electron com interface isolada, IPC restrito e análise pelo núcleo compartilhado.
- Qwen3-4B Q4_K_M executado por llama.cpp no próprio computador, sem chave e sem contingência de nuvem.
- Pacote Windows offline em dois arquivos: Setup e GGUF. O tamanho do modelo impedia o instalador monolítico; agora a cópia é automática e a integridade é conferida antes da inferência.
- Importação versionada de regras, métricas locais e exportação voluntária de feedback.
- Correções de escopo: “tem durante e depois, faltou antes” não implica duas faltas; “não tem durante nem depois” identifica as duas ausências.
- Busca sem confundir palavras pelo prefixo (por exemplo, registrar versus registro), regras agregadoras reservadas ao motor e verificação dos fatos no avaliador.
- Feedbacks simultâneos são serializados. Arquivo de feedback ilegível não é sobrescrito silenciosamente.

## Evidências e limites

A suíte automatizada passou com 383 testes e um teste opcional ignorado. Typecheck do projeto e desktop, builds da extensão, servidor Node e Worker (dry-run) passaram. A extensão MV3 foi validada. O teste real do Electron confirmou catálogo, ponte IPC, ausência de Node no renderer e uma decisão determinística. O teste usa um perfil isolado, não o perfil do analista.

O teste de inferência real com seis casos novos (`--offset=66 --limit=6`) teve quatro acertos e duas divergências, com base 2.14.0. Os quatro acertos usaram o motor determinístico. Nos casos de linguagem livre, uma frase de ausência durante foi associada indevidamente a orientação de adicional; outra recebeu o rótulo Reprovado, mas pela inclusão indevida de ausência antes. Acertar o rótulo pelo motivo errado continua sendo divergência. Foi acrescentada uma barreira que rejeita citações abrangendo orações de presença e ausência misturadas, em vez de usar esse mapeamento para decidir. **Essa amostra não aprova a qualidade do modelo.**

As duas chamadas ao modelo duraram aproximadamente 46–48 segundos nesta rodada. Os casos determinísticos levaram poucos milissegundos. São observações de desenvolvimento, não um benchmark controlado nem previsão para o Latitude 3420. Rodadas anteriores também oscilaram; acertar uma frase uma vez não comprova estabilidade.

O relatório detalhado está em `desktop-release/local-evaluation.json` (ignorado no Git). Uma execução posterior substitui esse relatório. Os 100 casos propostos ainda não foram integralmente executados com o modelo nem homologados pelo responsável operacional. A instalação completa, atualização e desinstalação precisam ser testadas pela TI em máquina limpa; gerar o Setup e testar o app não substitui esse ensaio. O instalador não possui assinatura corporativa.

## Próximo trabalho, na ordem

1. Reavaliar a interpretação local nas duas divergências, sem cadastrar artificialmente cada frase de teste nem relaxar a validação para produzir uma decisão.
2. Comparar o modo com raciocínio do mesmo Qwen e perfis de prompt/recuperação em um conjunto separado do usado para ajuste. Só adotar a configuração após medir qualidade e latência; a amostragem atual segue o perfil non-thinking oficial do Qwen.
3. Validar o gabarito operacional, rodar os 100 casos e repetições dos casos críticos no Latitude 3420 com os sistemas da empresa abertos.
4. Homologar instalação/atualização, assinatura/liberação e canal de distribuição das regras com a TI.
5. Iniciar 5–10 analistas supervisionados e ampliar apenas após aprovação dos resultados. Não distribuir amplamente como substituto de validação humana neste estado.

Nenhuma alteração desta etapa foi publicada no backend de produção. A rota online legada foi preservada. A implementação segue a apresentação à coordenação; não foi prometida qualidade equivalente ao Gemini ou ao ChatGPT para um modelo local de 4B.
