# Registry Overview
The @travetto/registry module is low-level framework infrastructure for metadata registration and discovery flows.

## What This Module Is
This module provides the base registry lifecycle used by other framework modules to collect decorator metadata during initialization and expose indexed runtime access.

## Why To Use It
- You are extending framework-level behavior with custom registries.
- You need centralized registration/indexing mechanics for discovered components.
- You are building advanced modules that must participate in startup registration flows.

## When To Use It
- Use when creating framework extensions, adapters, or registration-driven modules.
- Use when implementing custom RegistryIndex/RegistryAdapter patterns.

## When Not To Use It
- Do not use directly for most application-level business code.
- Prefer higher-level modules (schema, di, web, model, cli) unless you need registry internals.

## Core Capabilities
- Registry lifecycle orchestration for initialization and finalization.
- Adapter and index abstractions for per-class metadata registration.
- Indexed lookup patterns for runtime use after discovery.

## Decorators
- No consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- Registry for lifecycle and index registration.
- RegistryIndexStore as reusable storage/indexing helper.
- RegistryAdapter and RegistryIndex interfaces for custom implementations.

Decision guideline:
Use registry abstractions only when implementing framework-level discovery/indexing behavior, and keep application-level logic on higher-level modules that already consume registry state.

## Typical Integration Flow
1. Define a RegistryAdapter for class-level metadata.
2. Define a RegistryIndex that owns store lifecycle and access patterns.
3. Register metadata during decorator execution.
4. Query finalized index data after registry initialization.

## Practical Scenario
If you are authoring a framework plugin that discovers decorated classes and builds a runtime map, Registry provides the initialization/finalization contract to make that behavior deterministic.

Common pitfalls:
- Mixing registration side effects into application runtime paths.
- Treating registry initialization ordering as incidental instead of explicit lifecycle behavior.
- Building duplicate indexing systems when RegistryIndexStore can provide canonical storage.
