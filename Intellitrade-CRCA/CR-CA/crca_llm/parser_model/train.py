"""Train the custom parser model on synthetic (prompt, equations JSON) data."""

from __future__ import annotations

import argparse
from pathlib import Path

import torch

from crca_llm.parser_model.config import ParserModelConfig
from crca_llm.parser_model.data import generate_synthetic_batch
from crca_llm.parser_model.model import ParserTransformer
from crca_llm.parser_model.tokenizer import ParserTokenizer

SEP = "\n<json>\n"


def _collate(
    tokenizer: ParserTokenizer,
    max_length: int,
    batch: list[tuple[str, str]],
) -> tuple[torch.Tensor, torch.Tensor]:
    """Return (input_ids, labels) with -100 on prompt part."""
    pad_id = tokenizer.pad_id
    bos_id = tokenizer.bos_id
    eos_id = tokenizer.eos_id
    all_inputs = []
    all_labels = []
    for prompt, target in batch:
        prefix = f"Extract equations.\n\nInput: {prompt}\n\nOutput: "  # trailing space so first target token is '{'
        prefix_ids = tokenizer.encode(prefix, add_bos_eos=False)
        target_ids = tokenizer.encode(target, add_bos_eos=False)
        target_ids.append(eos_id)
        full = [bos_id] + prefix_ids + target_ids
        if len(full) > max_length:
            full = full[:max_length]
        label_start = 1 + len(prefix_ids)
        labels = [-100] * label_start + full[label_start:]
        if len(labels) < max_length:
            labels += [-100] * (max_length - len(labels))
            full += [pad_id] * (max_length - len(full))
        all_inputs.append(full[:max_length])
        all_labels.append(labels[:max_length])
    return torch.tensor(all_inputs, dtype=torch.long), torch.tensor(all_labels, dtype=torch.long)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train CR-CA equation parser model (sub-0.1B)")
    parser.add_argument("--out_dir", type=str, default="crca_parser_model", help="Output directory for checkpoint and tokenizer")
    parser.add_argument("--steps", type=int, default=500, help="Training steps")
    parser.add_argument("--batch_size", type=int, default=8)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu")
    args = parser.parse_args()

    config = ParserModelConfig()
    tokenizer = ParserTokenizer(vocab_size=config.vocab_size)
    model = ParserTransformer(config).to(args.device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    model.train()
    for step in range(args.steps):
        batch = generate_synthetic_batch(args.batch_size)
        inp, labels = _collate(tokenizer, config.max_length, batch)
        inp = inp.to(args.device)
        labels = labels.to(args.device)
        _, loss = model(inp, targets=labels)
        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        if (step + 1) % 50 == 0:
            print(f"step {step + 1} loss {loss.item():.4f}")

    from dataclasses import asdict
    torch.save({"config": asdict(config), "state_dict": model.state_dict()}, out_dir / "model.pt")
    tokenizer.save(out_dir / "tokenizer.json")
    print(f"Saved model and tokenizer to {out_dir} (params ~{config.n_params_approx})")


if __name__ == "__main__":
    main()
