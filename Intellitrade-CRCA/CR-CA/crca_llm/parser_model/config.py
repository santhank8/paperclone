"""Config for the custom sub-0.1B equation-parser model."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ParserModelConfig:
    """Keeps total parameters under 100M (sub-0.1B)."""

    vocab_size: int = 10_000
    max_length: int = 512
    n_layer: int = 4
    n_embd: int = 192
    n_head: int = 4
    dropout: float = 0.1

    @property
    def n_params_approx(self) -> int:
        e, v, l = self.n_embd, self.vocab_size, self.n_layer
        emb = 2 * v * e + self.max_length * e
        attn_ffn = l * (4 * e * e + 4 * e * (4 * e) * 2)
        head = e * v
        return int(emb + attn_ffn + head)
