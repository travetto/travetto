# Model Mongo Tips
- Connection strings are convenient, but verify parsed namespace/host settings in logs.
- Keep blob lifecycle and model lifecycle aligned to avoid orphaned content.
- Use provider-agnostic interfaces in business code, even when Mongo is the chosen backend.
- Enforce endpoint-level query constraints to protect against expensive unbounded searches.