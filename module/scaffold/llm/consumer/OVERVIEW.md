# Scaffold Overview
The @travetto/scaffold module provides interactive project scaffolding for new Travetto applications.

## What This Module Is
This module is a generator-oriented tooling package that bootstraps applications with selected framework features.

## Why To Use It
- It accelerates project setup with sane defaults.
- It composes feature selections into ready-to-run starter code.
- It reduces manual setup errors across common module combinations.

## When To Use It
- Use when creating a new Travetto application.
- Use when you want guided feature selection (web, model, auth, testing).
- Use when starter templates should follow current framework conventions.

## When Not To Use It
- Do not use for ongoing in-place refactors of an existing mature project.
- Do not assume scaffold output is final architecture without project-specific hardening.

## Core Capabilities
- Interactive feature selection.
- Template-based generation of app structure and starter code.
- Initial wiring for common feature combinations.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- Public surface is primarily CLI/generator workflow rather than utility classes.

## Core APIs and Extension Points
- Scaffold invocation via package runner (`npx @travetto/scaffold`).
- Feature/template composition hooks used by generator internals.
- Generated project defaults for module/config bootstrapping.

Decision guideline:
Use scaffold for first-boot project creation, then evolve generated code as normal application source.

## Typical Integration Flow
1. Run scaffold command.
2. Select desired features and integrations.
3. Generate project output.
4. Install dependencies and run the generated app/tests.

## Practical Scenario
For a new todo API, scaffold web + model + testing, then adapt generated model/controller/config to your domain before deploying.

Common pitfalls:
- Treating scaffold output as production-hardened without review.
- Selecting incompatible features without environment prerequisites.
- Skipping post-generation validation/tests.
