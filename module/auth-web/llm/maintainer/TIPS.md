# Auth Web Maintainer Tips
- Test with both valid and malformed tokens.
- Keep decorator behavior backward compatible for existing routes.
- Treat cookie/header transport changes as rollout-sensitive.
- Verify multi-step auth state is request-scoped and deterministic.
