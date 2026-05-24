# Model Query Tips
- Not every provider supports every clause with the same performance profile; code to the declared contract.
- `queryOne` is best for intentionally singular reads, not general search.
- Relative time strings are useful for date filters, but keep them explicit in application code.
- Use `model-indexed` when the access path is fixed and high-value.