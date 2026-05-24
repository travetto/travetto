# Email Nodemailer Instructions
How to configure nodemailer transport for framework email sending.

## Setup
1. Install @travetto/email-nodemailer and @travetto/email.
2. Register `NodemailerTransport` in DI.
3. Supply provider-specific options (SMTP/sendmail/SES) from environment config.

## Usage Workflow
- Keep transport config centralized in one factory/config module.
- Send all email payloads through @travetto/email service APIs.
- Validate transport connectivity in startup checks or integration tests.

Minimal pattern:
1. Create nodemailer transport config.
2. Register `NodemailerTransport` factory.
3. Use `EmailService` sends in business workflows.

## Safe Defaults
- Keep credentials out of source and load from secure environment config.
- Keep provider mode explicit (sendmail/smtp/ses).
- Keep retries/error handling aligned with your delivery policy.
