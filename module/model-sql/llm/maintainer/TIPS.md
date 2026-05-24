# Model SQL Maintainer Tips
- Small dialect contract changes can cascade into all SQL providers.
- Keep active-connection lifecycle and release logic extremely conservative.
- Use focused tests for nested transactions and rollback behavior.
- Avoid mixing provider-specific assumptions into core model-sql utility code.