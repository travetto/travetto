# Model Postgres Maintainer Tips
- Dialect and connection changes are high leverage and high risk.
- Keep metadata/introspection queries robust across PostgreSQL versions.
- Test rollback and nested transaction scenarios after transaction logic edits.
- Preserve clean separation between model-sql core and PostgreSQL-specific code.