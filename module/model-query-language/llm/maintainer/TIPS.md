# Model Query Language Maintainer Tips
- Tiny tokenizer edits can have large parse impacts, so pair changes with targeted tests.
- Keep grammar complexity in check; favor explicit syntax over ambiguous shorthand.
- Treat the parser as a translation layer, not a full semantic validator.
- Document new operators in README and module LLM docs in the same change.