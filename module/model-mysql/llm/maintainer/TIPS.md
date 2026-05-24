# Model MySQL Maintainer Tips
- MySQL version assumptions should be surfaced in tests, not hidden in code comments.
- Be conservative with connection/pool refactors.
- Validate introspection SQL against realistic schemas.
- Keep provider-specific behavior out of model-sql core utilities.