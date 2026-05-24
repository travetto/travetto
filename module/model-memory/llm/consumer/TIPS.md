# Model Memory Tips
- This provider is ideal for fast feedback, not durability.
- If a test depends on expiry cleanup, configure the culling cadence rather than relying on timing luck.
- Use it as a behavioral baseline when comparing a custom provider to core model contracts.
- Indexed lookups here are useful for contract validation, but they are still process-local structures.