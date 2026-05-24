# Transformer Overview
The @travetto/transformer module provides AST transformer registration utilities and shared transformation primitives.

## What This Module Is
This module is advanced compile-time infrastructure for declarative transformer wiring and TypeScript AST manipulation workflows.

## Why To Use It
- It enables framework-level compile-time enhancements impossible at runtime.
- It standardizes transformer registration and execution patterns.
- It provides reusable utilities for authoring consistent transformers.

## When To Use It
- Use when implementing compile-time behavior tied to source structure.
- Use when building framework extensions requiring AST transformations.
- Use when transformer discovery/registration should follow Travetto conventions.

## When Not To Use It
- Do not use when runtime metadata/registry features already solve the problem.
- Do not introduce non-idempotent transformations in monorepo compilation contexts.

## Core Capabilities
- Transformer handler/registration conventions.
- Stateful transformation utilities for node rewrite workflows.
- Shared patterns for before/after AST transform operations.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- `TransformerHandler` and transformer state helpers for registration and node updates.

## Core APIs and Extension Points
- `support/transformer.<name>.ts` discovery conventions.
- Transformer handler registration interfaces.
- State/factory helpers for node mutation during compile.

Decision guideline:
Use this module only for carefully scoped, deterministic compile-time transformations, and prefer existing foundational transformers before creating new ones.

## Typical Integration Flow
1. Define transformer class/handler methods.
2. Register handlers with transformer utilities.
3. Ensure opt-in behavior is code-evident.
4. Validate emitted output/idempotency across build contexts.

## Practical Scenario
For metadata injection at compile time, register a before-class handler that adds deterministic helper nodes while preserving source compatibility in repeated builds.

Common pitfalls:
- Breaking identifier semantics in transformed output.
- Creating transformations that differ across dependency/build order.
- Overusing AST rewrites where runtime hooks would be safer.
