# DI Overview
The @travetto/di module manages the lifecycle and dependencies of your application components.

## Primary Capabilities
- Automated dependency injection via decorators.
- Support for singleton, request, and transient scopes.
- Interface-based injection and multi-implementation support.
- Dependency discovery and wiring at startup.

## Decorators (Consumer API)

- @Injectable: register a class as dependency-managed and injectable.
- @Inject: request injection of a dependency into a field or parameter.
- @InjectableFactory: expose a factory method as the provider for a dependency target.
- @PostConstruct: run initialization logic after dependencies are fully wired.

## Utility APIs

- This module does not expose consumer-focused util classes under non-internal paths.
- Primary programmatic API is DependencyRegistryIndex for lookups and advanced retrieval.

## When to use it
Use this for all service-level code to maintain decoupling and testability.
