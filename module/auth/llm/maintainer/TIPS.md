# Auth Maintainer Tips
- Breaking changes in principal/token types have wide downstream impact.
- Keep auth context operations request-safe and side-effect constrained.
- Prefer additive contract evolution over semantic redefinition.
