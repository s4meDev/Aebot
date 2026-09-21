# ADR 001 — Aplicativo desktop com IA local

Data: 21/09/2026. Fonte: apresentação `AEBOT_Rota_Desktop_IA_Local_Coordenacao.pptx`, 14 slides e notas. Status: implementação do protótipo; homologação operacional pendente.

## Decisão

Cada analista executa a IA no seu notebook. Até 60 instalações independentes, sem cobrança por chamada e sem servidor compartilhado. Preservamos o núcleo de regras e os perfis antigos durante a transição. O novo desktop não envia perguntas nem métricas à nuvem.

Electron foi escolhido para reaproveitar React/TypeScript e o motor sem reescrever o núcleo em outra linguagem. O custo é um pacote maior que uma casca WebView; o modelo de cerca de 2,5 GB já domina o tamanho da distribuição. A interface é sandboxed, sem Node, com context isolation, navegação bloqueada e ponte IPC restrita. O runtime CPU llama.cpp é um processo separado gerenciado pelo aplicativo, sem console visível, vinculado apenas a 127.0.0.1 e autenticado por segredo temporário.

Qwen3-4B Q4_K_M é o modelo inicial solicitado, não uma garantia de qualidade. O cliente usa schema JSON e modo sem thinking para reduzir latência. A amostragem segue o perfil non-thinking do [model card oficial](https://huggingface.co/Qwen/Qwen3-4B#best-practices): temperatura 0,7, top-p 0,8, top-k 20 e min-p 0. Seed fixa facilita a comparação de testes, mas não garante determinismo entre máquinas. Saídas truncadas, JSON inválido ou IDs/citações não sustentadas não autorizam conclusão. Os fatos estruturados reutilizam `SemanticRuleMapping`: regra candidata, trecho citado, expressão canônica validada e modalidade do relato. Não há duas bases nem um novo motor concorrente.

## Governança

A base editável continua sendo `src/data/rulesStore.json`. A distribuição usa envelope JSON com `format`, `owner`, `effectiveAt`, `changes` e `store`. O importador exige versão superior, schema válido e vigência iniciada, preservando a última base. Isso é controle de versão, não autenticação criptográfica do autor. A TI precisa distribuir os pacotes em canal controlado; assinatura de regras e instalador devem ser decididas com a empresa.

Não criamos sincronização automática que tornaria a internet obrigatória. Arquivos pequenos podem ser distribuídos por Software Center, compartilhamento interno ou mídia e importados localmente. O modelo e o aplicativo possuem ciclos independentes da base.

## Validação e limites

As regras têm regressões automatizadas e o cliente local possui testes de contrato. `desktop:evaluate` executa inferência real sobre o corpus técnico, registrando divergências, aprovação indevida e latência. Esse corpus não substitui 100 perguntas reais/simuladas com gabarito aprovado pela referência operacional. A medição neste computador não representa automaticamente o Latitude 3420.

O pacote de distribuição contém Setup e modelo GGUF auxiliar na mesma pasta; o Setup copia os recursos e não exige instalação manual de IA. O modelo ultrapassa o limite de 2 GB do arquivo embutido NSIS, por isso não está dentro do EXE. Download é feito uma vez pela máquina de preparação. Piloto: 5–10 analistas; expansão até 60 condicionada a qualidade, latência e disponibilidade de memória aceitáveis com os sistemas corporativos abertos.

## Referências técnicas

- [Segurança Electron](https://www.electronjs.org/docs/latest/tutorial/security)
- [Qwen3-4B GGUF oficial](https://huggingface.co/Qwen/Qwen3-4B-GGUF)
- [Servidor llama.cpp](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)
