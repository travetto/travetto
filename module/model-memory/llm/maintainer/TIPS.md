# Model Memory Maintainer Tips
- Treat this module as executable documentation for provider authors.
- Be careful when refactoring private helpers that coordinate store and index mutation.
- Keep failure modes aligned with core model and model-indexed error contracts.
- Avoid introducing behavior that only exists here but not in provider contracts.