# Email Compiler Overview
The @travetto/email-compiler module provides template compilation workflows for email engines and compiled asset outputs.

## What This Module Is
This module is a build/development toolchain for converting email templates into compiled html/text/subject artifacts consumed by the email runtime.

## Why To Use It
- It standardizes email template compilation across engines.
- It supports watch-mode development and iterative authoring.
- It manages asset resolution, style optimization, and output generation.

## When To Use It
- Use when authoring templated email content for production delivery.
- Use when template artifacts should be generated during build/CI.
- Use when image/style assets need controlled compile-time handling.

## When Not To Use It
- Do not hand-maintain compiled artifacts as source of truth.
- Do not bypass compile pipeline when relying on engine wrappers/styles.

## Core Capabilities
- CLI-driven compile and watch workflows.
- Engine-aware template rendering and wrapper integration.
- Asset resolution and precedence handling.
- Output generation to `.compiled.html`, `.compiled.text`, and `.compiled.subject`.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- `email:compile` CLI command surface.
- Engine template/wrapper extension points.
- Asset lookup and override precedence behavior.

Decision guideline:
Use email-compiler as the canonical source for compiled template artifacts, keeping authored templates as source and compiled files as build outputs.

## Typical Integration Flow
1. Author templates under supported source paths.
2. Configure asset and wrapper overrides as needed.
3. Run compile/watch workflows to generate compiled outputs.
4. Use generated artifacts with @travetto/email send flows.

## Practical Scenario
For a transactional email suite, maintain source templates and shared styles in resources/support, run `email:compile` during CI, and deploy compiled artifacts with the application bundle.

Common pitfalls:
- Committing stale compiled outputs without matching source changes.
- Misconfiguring asset precedence and accidentally shadowing defaults.
- Treating watch output as production-ready without CI compile validation.
