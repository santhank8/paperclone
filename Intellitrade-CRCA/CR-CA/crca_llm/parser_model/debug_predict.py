"""Print parsed equations for a given input. Run from CR-CA (repo root of CR-CA):
  python3 -m crca_llm.parser_model.debug_predict 'X = U_X; Y = 2*X + U_Y'
  python3 -m crca_llm.parser_model.debug_predict --raw '...'  # print raw decoded output too
"""

from __future__ import annotations

import sys

from crca_llm.parser_model.inference import (
    load_parser_model,
    predict_equations_robust,
    PROMPT_PREFIX,
    OUTPUT_PREFIX,
    _decode_and_parse,
)
import torch


def main() -> None:
    args = sys.argv[1:]
    raw_mode = "--raw" in args
    if raw_mode:
        args = [a for a in args if a != "--raw"]
    text = args[0] if args else "X = U_X; Y = 2*X + U_Y"
    model_dir = "crca_parser_model"
    model, tokenizer = load_parser_model(model_dir)
    if raw_mode:
        prompt = PROMPT_PREFIX + text + OUTPUT_PREFIX
        ids = tokenizer.encode(prompt, add_bos_eos=True)
        idx = torch.tensor([ids], dtype=torch.long)
        out = model.generate(idx, max_new_tokens=512, eos_token_id=tokenizer.eos_id, temperature=0.0)
        out_ids = out[0].tolist()
        decoded, _ = _decode_and_parse(tokenizer, out_ids, len(ids))
        print("--- Raw decoded ---")
        print(repr(decoded[:800] if decoded else ""))
        print("--- Generated tokens ---", len(out_ids) - len(ids))
    result = predict_equations_robust(model, tokenizer, text)
    print("--- Parsed equations ---")
    print(result)

if __name__ == "__main__":
    main()
