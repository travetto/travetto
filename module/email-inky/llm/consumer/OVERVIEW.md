# Email Inky Overview
The @travetto/email-inky module provides JSX-based Inky template authoring for email compilation workflows.

## What This Module Is
This module is an email templating engine integration that maps JSX components to Inky/mustache-compatible email template output.

## Why To Use It
- It provides typed JSX authoring for email templates.
- It supports Inky component-driven responsive email layout.
- It bridges mustache substitutions with JSX-safe helper components.

## When To Use It
- Use when authoring rich responsive email templates with compile-time checks.
- Use when template conditional/loop/substitution behavior must remain readable.
- Use when integrating with email-compiler build workflows.

## When Not To Use It
- Do not handcraft complex raw html templates if JSX+Inky abstractions fit your use case.
- Do not mix mustache syntax directly where JSX component helpers should be used.

## Core Capabilities
- JSX component set for Inky template structure.
- Control-flow helper components (`If`, `Unless`, `For`).
- Value substitution component support.
- Engine-specific wrapper/style extension points.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- Template components such as `InkyTemplate`, `Container`, `Row`, `Column`, `Button`, `Value`.
- Control-flow components for mustache-compatible logic.
- Engine extension points (`email/inky.variables.scss`, `email/inky.wrapper.html`).

Decision guideline:
Use inky JSX components as the canonical authoring surface and let compilation handle final html/mustache output concerns.

## Typical Integration Flow
1. Author template JSX with Inky and helper components.
2. Use value/control-flow components for substitutions and conditions.
3. Compile templates through email-compiler.
4. Send compiled artifacts through @travetto/email.

## Practical Scenario
For branded transactional emails, compose reusable Inky component structures in JSX, apply style overrides via inky variables/wrapper files, and compile into deployable artifacts.

Common pitfalls:
- Embedding raw mustache control flow directly where JSX helper components are required.
- Ignoring wrapper/style extension points and duplicating layout code across templates.
- Using substitutions in contexts unsupported by component/property constraints.
