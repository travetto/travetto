# Web Http Instructions
How to run web applications on the HTTP server module safely.

## Setup
1. Install @travetto/web-http.
2. Configure `web.http` settings (port, bind address, version, TLS).
3. Start server with `trv web:http` or custom CLI entrypoint.

## Usage Workflow
- Keep server config centralized in config classes/profiles.
- Use framework startup and dispatcher integration paths.
- Use TLS key configuration explicitly for production environments.

Minimal pattern:
1. Define/override `WebHttpConfig`.
2. Start server via CLI/DI-managed server instance.
3. Validate startup banner and listening state.

## Safe Defaults
- Use default development TLS generation only in non-production.
- Keep bind address/port explicit in deployment profiles.
- Keep custom startup logic in CLI command wrappers, not ad hoc scripts.
