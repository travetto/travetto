# Email Instructions
How to use email sending contracts safely.

## Setup
1. Install @travetto/email.
2. Register an `EmailTransport` (null, nodemailer bridge, or custom).
3. Inject and use `EmailService` from application services.

## Usage Workflow
- Send direct `EmailOptions` payloads for simple flows.
- Use template-key sends when compiled assets are available.
- Keep sender/from/recipient defaults explicit in config.

Minimal pattern:
1. Build typed email payload.
2. Call `EmailService` send API.
3. Handle transport errors with retry/observability strategy.

## Safe Defaults
- Use `NullTransport` in local/dev unless explicit external delivery is required.
- Keep production transport credentials and host config environment-scoped.
- Treat template resolution failures as deployment/config issues, not silent fallbacks.
