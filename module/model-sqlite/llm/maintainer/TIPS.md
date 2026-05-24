# Model Sqlite Maintainer Tips
- Concurrency and lock behavior are the highest-risk surfaces.
- Keep SQL overrides minimal and covered by targeted tests.
- Validate behavior against realistic file-backed workloads.
- Avoid moving provider-specific logic into model-sql core.