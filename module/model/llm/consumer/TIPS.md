# Model Tips
- Do not hide heavy business logic in lifecycle hooks.
- Use ModelCrudUtil/ModelExpiryUtil semantics when adding cross-provider behavior.
- Keep @Transient fields out of persistence assumptions.
- Validate model changes against at least one concrete provider in integration tests.
