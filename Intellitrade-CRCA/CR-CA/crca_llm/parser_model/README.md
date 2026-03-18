# Custom sub-0.1B equation parser model

Tiny transformer (~11M params) for extracting structural equation JSON from prompt text. Use when `CRCA_PARSER_MODEL=local:<path>`.

## Train

```bash
cd CR-CA
python3 -m crca_llm.parser_model.train --out_dir crca_parser_model --steps 2000 --batch_size 8
```

Longer training (e.g. 2000+ steps) improves output quality. Outputs `model.pt` and `tokenizer.json` in `out_dir`.

## Use

Set the env to the directory containing `model.pt` and `tokenizer.json`:

```bash
export CRCA_PARSER_MODEL=local:/path/to/crca_parser_model
```

The equation extractor will load this model (CPU or GPU) instead of calling an API.
