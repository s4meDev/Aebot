"""Relaciono o trecho ao assunto. Relevância, sozinha, não comprova ocorrência."""
from pathlib import Path
import time
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer


class LocalReranker:
    def __init__(self, directory: Path, threads: int = 4):
        started = time.perf_counter()
        self.tokenizer = Tokenizer.from_file(str(directory / "tokenizer.json"))
        options = ort.SessionOptions()
        options.intra_op_num_threads = threads
        options.inter_op_num_threads = 1
        options.log_severity_level = 3
        self.session = ort.InferenceSession(str(directory / "onnx/model_quantized.onnx"),
            sess_options=options, providers=["CPUExecutionProvider"])
        self.load_ms = (time.perf_counter() - started) * 1000
        self.calls = 0

    def score(self, pairs: list[tuple[str, str]]) -> list[float]:
        if not pairs:
            return []
        encodings = self.tokenizer.encode_batch(pairs)
        if any(len(item.ids) > 512 for item in encodings):
            raise ValueError("Trecho longo demais para interpretar sem corte.")
        self.calls += 1
        result = [0.0] * len(pairs)
        ordered = sorted(range(len(pairs)), key=lambda index: len(encodings[index].ids))
        # A quantização dinâmica deste arquivo muda com a composição do lote.
        # Um par por vez mantém a interpretação independente das outras regras
        # cadastradas e evita padding e picos de memória desnecessários.
        for start in range(len(ordered)):
            indices = ordered[start:start + 1]
            size = max(len(encodings[index].ids) for index in indices)
            fields = {"input_ids": [], "attention_mask": [], "token_type_ids": []}
            for index in indices:
                item = encodings[index]
                pad = size - len(item.ids)
                fields['input_ids'].append(item.ids + [1] * pad)
                fields['attention_mask'].append(item.attention_mask + [0] * pad)
                fields['token_type_ids'].append(item.type_ids + [0] * pad)
            inputs = {item.name: np.asarray(fields[item.name], dtype=np.int64) for item in self.session.get_inputs()}
            scores = self.session.run(None, inputs)[0].reshape(-1)
            for index, score in zip(indices, scores):
                result[index] = float(score)
        return result
