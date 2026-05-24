# Model SQL Tips
- If you need legacy-schema adaptation, validate assumptions early before committing to this module family.
- Prefer provider-specific modules for runtime use; treat model-sql as the shared foundation.
- Use indexed contracts for high-value deterministic lookups and query contracts for broader filtering.
- Keep connection pool and transaction settings consistent with workload profile.