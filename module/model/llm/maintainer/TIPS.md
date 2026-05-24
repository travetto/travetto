# Model Maintainer Tips
- Avoid backend-specific assumptions in core util behavior.
- Keep preStore/load paths deterministic and side-effect constrained.
- Guard changes to ID generation and expiry semantics with targeted tests.
