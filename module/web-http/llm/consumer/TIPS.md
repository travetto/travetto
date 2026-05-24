# Web Http Tips
- Treat TLS key management as deployment configuration, not code defaults.
- Keep HTTP version choice explicit and documented per environment.
- Validate server startup through health checks in CI/staging.
- Use custom CLI commands for startup customization rather than bypassing framework bootstrap.
