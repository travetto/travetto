# Model Redis Tips
- This provider focuses on CRUD + indexed, not full model-query contract parity.
- Validate behavior for string-sorted versus numeric-sorted index fields.
- Keep key naming stable when changing namespace strategy.
- Maintain provider-agnostic business code for backend portability.