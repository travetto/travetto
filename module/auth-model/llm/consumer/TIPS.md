# Auth Model Tips
- Keep user-model to principal mapping deterministic and versioned.
- Use `AuthModelUtil` helpers for hashing; do not roll your own crypto wrappers.
- Treat password reset token lifecycle as compatibility-sensitive data.
- Keep auth-model persistence logic out of controller methods.
