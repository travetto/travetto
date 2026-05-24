# Model Indexed Tips
- Use `model-query` for ad hoc filtering; use `model-indexed` for explicit, repeatable access paths.
- Missing key fields are an error, not an implicit wildcard.
- Keep sorted-index sort fields numeric or date-based so ordering stays consistent.
- Reuse exported index definitions instead of rebuilding lookup templates in application code.