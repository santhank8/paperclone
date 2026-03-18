"""Simple tokenizer for parser model: character-level + special tokens."""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Union

# Special tokens
PAD = "<pad>"
BOS = "<bos>"
EOS = "<eos>"
UNK = "<unk>"
SPECIAL = [PAD, BOS, EOS, UNK]


class ParserTokenizer:
    """Maps text to ids using a fixed vocab (chars + special). Sub-10k vocab."""

    def __init__(self, vocab_size: int = 10_000) -> None:
        self.vocab_size = vocab_size
        self.special_ids = {t: i for i, t in enumerate(SPECIAL)}
        self._char_to_id: dict[str, int] = {}
        self._id_to_char: dict[int, str] = {}
        self._build_char_vocab()

    def _build_char_vocab(self) -> None:
        # Reserve 0..len(SPECIAL)-1 for special; then printable ASCII and common UTF-8
        for i, t in enumerate(SPECIAL):
            self._id_to_char[i] = t
        idx = len(SPECIAL)
        for c in range(32, 127):
            self._char_to_id[chr(c)] = idx
            self._id_to_char[idx] = chr(c)
            idx += 1
        for c in ["\n", "\t", " "] + [chr(c) for c in range(128, 256)]:
            if c not in self._char_to_id and idx < self.vocab_size:
                self._char_to_id[c] = idx
                self._id_to_char[idx] = c
                idx += 1
        self.pad_id = self.special_ids[PAD]
        self.bos_id = self.special_ids[BOS]
        self.eos_id = self.special_ids[EOS]
        self.unk_id = self.special_ids[UNK]

    def encode(self, text: str, add_bos_eos: bool = True) -> List[int]:
        ids = [self.bos_id] if add_bos_eos else []
        for c in text:
            ids.append(self._char_to_id.get(c, self.unk_id))
        if add_bos_eos:
            ids.append(self.eos_id)
        return ids

    def decode(self, ids: List[int], skip_special: bool = True) -> str:
        out = []
        for i in ids:
            if i in self._id_to_char:
                t = self._id_to_char[i]
                if skip_special and t in SPECIAL:
                    continue
                out.append(t)
        return "".join(out)

    def save(self, path: Union[str, Path]) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"vocab_size": self.vocab_size, "char_to_id": self._char_to_id, "id_to_char": {int(k): v for k, v in self._id_to_char.items()}}, f, indent=0)

    @classmethod
    def load(cls, path: Union[str, Path]) -> "ParserTokenizer":
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        tok = cls(vocab_size=d["vocab_size"])
        tok._char_to_id = d["char_to_id"]
        tok._id_to_char = {int(k): v for k, v in d["id_to_char"].items()}
        return tok
