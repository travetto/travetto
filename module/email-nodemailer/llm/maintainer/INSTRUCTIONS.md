# Email Nodemailer Maintainer Instructions

## Change Strategy
- Preserve adapter behavior against framework email transport contract.
- Keep nodemailer option passthrough semantics stable.
- Prefer additive transport support changes.

## Implementation Notes
- Keep provider-mode handling explicit and test-backed.
- Avoid hidden defaults that alter existing deployment behavior.
- Ensure errors map cleanly for framework-level handling.

## Validation
- Run module tests for transport initialization and send behavior.
- Validate at least one SMTP/sendmail/SES representative path.
- Recheck integration with @travetto/email service flows.

## Regression Checklist
- Transport contract compatibility remains stable.
- Option mapping remains predictable.
- Failure behavior remains deterministic and actionable.
