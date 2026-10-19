# Componentes do protótipo Python

Não distribuo chaves, conversas ou os modelos experimentais rejeitados.

- BAAI/bge-reranker-v2-m3: Apache-2.0. Modelo original: https://huggingface.co/BAAI/bge-reranker-v2-m3
- Conversão ONNX: https://huggingface.co/onnx-community/bge-reranker-v2-m3-ONNX . Revisão e hashes em `reranker.lock.json`; pesos não modificados pelo AEBOT.
- ONNX Runtime: MIT; NumPy: BSD e licenças de componentes distribuídos; Tokenizers: Apache-2.0; jsonschema: MIT.
- Python: PSF; Tcl/Tk: licenças Tcl/Tk incluídas com o runtime.
- PyInstaller: GPL com exceção para distribuição dos executáveis gerados; não transfere a licença GPL automaticamente para o aplicativo.

As licenças disponíveis nas distribuições instaladas são copiadas para `LICENSES/` no pacote. O texto Apache-2.0 acompanha o modelo. A lista de versões empacotadas fica em `DEPENDENCIAS.txt`. Consulte as distribuições originais para os avisos completos e suas respectivas autorias.
