# Email Nodemailer Overview
The @travetto/email-nodemailer module provides a nodemailer-backed transport implementation for @travetto/email.

## What This Module Is
This module adapts nodemailer transport options into the framework email transport contract.

## Why To Use It
- It enables production-ready SMTP/sendmail/SES transport configurations.
- It reuses nodemailer ecosystem capabilities through framework abstractions.
- It keeps application-level email send logic independent of nodemailer specifics.

## When To Use It
- Use when @travetto/email needs real delivery transport in non-dev environments.
- Use when nodemailer-compatible providers/features are required.
- Use when transport behavior should be configured through DI and environment config.

## When Not To Use It
- Do not use for local/dev no-delivery workflows where null transport is desired.
- Do not expose nodemailer config details directly throughout application services.

## Core Capabilities
- Nodemailer transport adapter implementing framework transport contract.
- Support for sendmail, SMTP, SES, and other nodemailer transport modes.
- Configurable transport creation through DI factories.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- `NodemailerTransport`: transport implementation for @travetto/email.
- Transport options passed through nodemailer-compatible configuration objects.

Decision guideline:
Use nodemailer transport wiring through DI as the canonical production delivery path when adopting @travetto/email.

## Typical Integration Flow
1. Install @travetto/email and @travetto/email-nodemailer.
2. Register `NodemailerTransport` through an injectable factory.
3. Configure provider-specific transport options by environment.
4. Send through `EmailService` without nodemailer-specific logic at call sites.

## Practical Scenario
For cloud SMTP delivery, register `NodemailerTransport` with environment-configured credentials and let business services continue to send via framework email APIs.

Common pitfalls:
- Spreading nodemailer transport config construction across multiple services.
- Mixing null and nodemailer transport expectations in one environment.
- Changing transport option semantics without validating provider compatibility.
