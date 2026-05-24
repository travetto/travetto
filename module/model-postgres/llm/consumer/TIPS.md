# Model Postgres Tips
- Treat this module as a backend adapter, not the primary service API.
- Keep app code on shared model interfaces so backend swaps remain possible.
- Verify extension/setup permissions (for pgcrypto use) in deployment environments.
- Profile query-heavy paths to tune indexes and SQL behavior.