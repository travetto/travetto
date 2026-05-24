# Eslint Overview
The @travetto/eslint module provides framework-oriented ESLint configuration and custom rule plugin support.

## What This Module Is
This module delivers CLI-assisted ESLint configuration registration and a plugin pattern for custom Travetto lint rules.

## Why To Use It
- It standardizes lint setup for Travetto projects.
- It bridges framework module conventions with ESLint config/runtime behavior.
- It supports custom rule plugins for repository-specific conventions.

## When To Use It
- Use when bootstrapping linting in a Travetto workspace.
- Use when enforcing framework-specific code style or import patterns.
- Use when integrating lint workflows into CI and local tooling.

## When Not To Use It
- Do not handcraft incompatible lint bootstrap scripts when module commands are available.
- Do not bypass registered config when expecting consistent workspace lint behavior.

## Core Capabilities
- CLI registration of project eslint config.
- CLI lint execution within framework-aware context.
- Custom rule plugin contract support.
- Support for ESM-oriented lint config patterns.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- CLI commands (`eslint:register`, `eslint`).
- `TrvEslintPlugin` contract for custom lint rule definitions.
- Support files under `support/eslint/*` for project-local rule registration.

Decision guideline:
Use module-provided ESLint registration and plugin contracts to keep lint behavior deterministic across workspace tools and CI.

## Typical Integration Flow
1. Run `trv eslint:register` to create project config.
2. Run `trv eslint` in local and CI workflows.
3. Add custom rules via the plugin contract under support paths.
4. Keep config and custom rule behavior aligned with framework module mode (ESM/CJS).

## Practical Scenario
For monorepo import-order enforcement, register base config, add a custom plugin rule in support/eslint, and run lint in CI to keep cross-module imports consistent.

Common pitfalls:
- Editing generated config patterns without understanding module mode implications.
- Adding custom rules without explicit default levels and test coverage.
- Assuming editor lint config matches CLI registration output automatically.
