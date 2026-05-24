# Email Overview
The @travetto/email module provides email composition and sending contracts with pluggable transports and optional template integration.

## What This Module Is
This module is the framework email sending surface, defining transport abstraction, options contracts, and support for compiled template-based delivery.

## Why To Use It
- It standardizes email send behavior across local and production environments.
- It allows transport substitution without changing call sites.
- It supports compiled html/text/subject template workflows.

## When To Use It
- Use when services need to send transactional or notification emails.
- Use when transport and rendering concerns should be centralized.
- Use when template artifacts are precompiled and loaded by key.

## When Not To Use It
- Do not hardcode transport-specific send logic in business services.
- Do not use templated send paths without providing required compiled assets.

## Core Capabilities
- Transport-based send abstraction with configurable provider wiring.
- Support for direct `EmailOptions` payload sending.
- Support for compiled template key resolution (`.compiled.html/.text/.subject`).
- Environment-safe default transport behavior via null transport.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- `EmailService`: primary sending orchestration surface.
- `EmailTransport` contract and `NullTransport` default implementation.
- `MailConfig` and email option/type contracts.

Decision guideline:
Use email transport contracts and centralized service wiring as the canonical boundary for outbound mail behavior.

## Typical Integration Flow
1. Configure and register an email transport via DI.
2. Compose and send email payloads through `EmailService`.
3. Use compiled template key sends where template pipeline is in place.
4. Keep environment-specific transport config outside business code.

## Practical Scenario
For account onboarding, send a welcome email via a production transport while keeping local/dev environments on null transport to avoid accidental external delivery.

Common pitfalls:
- Sending templated emails without compiled subject/html assets.
- Mixing transport SDK calls directly into application services.
- Treating null transport behavior as production-safe delivery.
