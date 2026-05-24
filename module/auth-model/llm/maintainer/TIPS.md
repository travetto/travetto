# Auth Model Maintainer Tips
- Treat mapping changes as data-migration-sensitive.
- Keep hash and reset-token semantics stable across releases.
- Test with old and newly-created user records.
- Keep service-level auth error categories predictable.
