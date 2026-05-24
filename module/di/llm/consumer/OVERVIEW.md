# DI Overview
The @travetto/di module manages the lifecycle and dependencies of your application components.

## What This Module Is
This module is the framework dependency injection container and registration system for class-based dependencies.

## Why To Use It
- It separates object construction from object usage.
- It enables modular composition and substitution of implementations.
- It standardizes lifecycle behavior for injected services.

## When To Use It
- Use for service construction and dependency wiring.
- Use when implementations vary by environment or qualifier.
- Use when initialization must run after dependency graph assembly.

## When Not To Use It
- Do not instantiate shared services manually when DI can manage lifecycle.
- Do not use DI for simple local helpers with no lifecycle/dependency needs.

## Core Capabilities
- Automated dependency injection via decorators.
- Support for singleton, request, and transient scopes.
- Interface-based injection and multi-implementation support.
- Dependency discovery and wiring at startup.

## Decorators

- @Injectable: register a class as dependency-managed and injectable.
- @Inject: request injection of a dependency into a field or parameter.
- @InjectableFactory: expose a factory method as the provider for a dependency target.
- @PostConstruct: run initialization logic after dependencies are fully wired.

## Utility Classes (Non-Internal)

- This module does not expose consumer-focused util classes under non-internal paths.
- Primary programmatic API is the DI registry index for lookups and advanced retrieval.

## Core APIs and Extension Points
- DI registry index APIs for programmatic resolution and registry behavior.
- Injectable factories and qualifiers for controlled implementation selection.

## Typical Integration Flow
1. Mark implementations with @Injectable.
2. Inject dependencies with @Inject or constructor parameters in services consumed by web, model, and CLI layers.
3. Use qualifiers/factories where multiple candidates exist.
4. Use @PostConstruct for initialization requiring injected dependencies.

## Practical Scenario
When supporting multiple payment providers, register each implementation as injectable and select the appropriate one by qualifier without changing consumer service logic.

