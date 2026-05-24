# Model Sqlite Tips
- Use SQLite as an adapter backend through model-sql, not as a custom API layer.
- Validate regex and timestamp behaviors if portability to other SQL providers matters.
- Keep write-heavy concurrency expectations realistic for SQLite.
- Use provider-agnostic interfaces in domain code.