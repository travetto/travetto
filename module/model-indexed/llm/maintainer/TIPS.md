# Model Indexed Maintainer Tips
- Changes in `computed.ts` are high blast-radius because providers share the same key extraction model.
- Preserve error predictability for missing key and sort values.
- Do not blur query semantics into indexed semantics; keep the contract intentionally narrow.
- When adding helpers, keep them provider-agnostic and test them against at least one real backend.