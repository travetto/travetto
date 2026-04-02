# Travetto Framework Development Guidelines

Comprehensive development conventions and patterns for the Travetto framework codebase, for LLM use.

## Project Overview

Travetto is a TypeScript application framework organized as a **monorepo** using npm workspaces. It targets Node.js with ESM (`"type": "module"`) and uses TypeScript 6.x. The framework emphasizes **decorator-driven meta-programming**, **compile-time AST transformation**, and **runtime registry-based metadata**.

### Philosophy

1. **TypeScript as the development platform** — deeply tied to the TypeScript compiler and type system.
2. **Code over configuration** — prefer decorators and meta-programming over config files.
3. **Don't repeat information** — source code transformation fills in boilerplate automatically.
4. **Minimal footprint** — keep dependencies and code volume small.
5. **Development responsiveness** — instant feedback via hot-reloading and watch mode.

## Repository Structure

```
/
├── module/               # All framework modules (@travetto/*)
│   ├── runtime/          # Foundation: types, errors, utilities
│   ├── registry/         # Class registry system
│   ├── di/               # Dependency injection
│   ├── schema/           # Data type declaration & validation
│   ├── config/           # Configuration loading
│   ├── model/            # Data persistence contracts
│   ├── model-memory/     # Model implementation (memory)
│   ├── model-mongo/      # Model implementation (MongoDB)
│   ├── web/              # Web API framework
│   ├── auth/             # Authentication/authorization
│   ├── test/             # Test framework
│   ├── compiler/         # TypeScript compiler extensions
│   ├── transformer/      # AST transformation framework
│   ├── doc/              # Documentation generation
│   ├── cli/              # CLI framework
│   └── ...               # ~50+ modules total
├── global-test/          # Cross-module integration tests
├── related/              # Related projects (todo-app, vscode-plugin)
├── archived/             # Deprecated modules
├── notes/                # Development notes and milestones
├── support/              # Repo-level CLI commands and ESLint plugins
└── resources/            # Shared configuration files
```

### Module Internal Structure

Every module follows this layout:

```
module/<name>/
├── __index__.ts          # Barrel export (public API surface)
├── package.json          # Module metadata and dependencies
├── DOC.tsx               # JSX-based documentation source
├── DOC.html              # Generated HTML documentation
├── README.md             # Generated Markdown documentation
├── src/                  # Source code
│   ├── decorator.ts      # Decorator definitions
│   ├── types.ts          # Type definitions
│   ├── service.ts        # Service implementations
│   ├── registry/         # Registry index and adapter
│   ├── error/            # Module-specific error classes
│   ├── util/             # Utility functions
│   └── internal/         # Non-public implementation details
├── support/              # Framework integration files
│   ├── cli.*.ts          # CLI command definitions
│   ├── test/             # Shared test suites (reusable by consumers)
│   ├── doc.support.tsx   # Shared doc components
│   ├── transformer.*     # AST transformer definitions
│   └── bin/              # Support binaries/utilities
├── test/                 # Module tests
│   ├── *.ts              # Test suite files
│   ├── models/           # Test-specific models
│   └── fixtures/         # Test fixture data
└── doc/                  # Documentation example files
    └── *.ts              # Code samples referenced by DOC.tsx
```

## TypeScript Conventions

### Module System

- **ESM only** — all modules use `"type": "module"`.
- **File extensions in imports** — always include `.ts` extension in relative imports:
  ```ts
  import { MyClass } from './src/types.ts';
  import type { Config } from '../config/types.ts';
  ```
- **Package imports** — use bare specifiers for npm packages and `@travetto/*` modules:
  ```ts
  import assert from 'node:assert';
  import { Injectable } from '@travetto/di';
  ```

### Import Ordering

Imports must be grouped in this order, separated by blank lines:

1. **Node built-ins** — `node:assert`, `node:fs/promises`, `node:path`, etc.
2. **External packages** — third-party npm packages
3. **Travetto modules** — `@travetto/*` imports
4. **Local imports** — relative `./` and `../` paths

```ts
import fs from 'node:fs/promises';

import { someLib } from 'external-package';

import { Injectable } from '@travetto/di';
import { Schema } from '@travetto/schema';

import { MyUtil } from './util.ts';
import type { MyConfig } from './types.ts';
```

This is enforced by a custom ESLint rule (`@travetto-import/order`).

### Type Imports

Use `import type` for type-only imports:

```ts
import type { ModelType } from '@travetto/model';
import { type Class, castTo } from '@travetto/runtime';
```

### Barrel Exports (`__index__.ts`)

Each module's `__index__.ts` re-exports the public API using star exports:

```ts
export * from './src/decorator.ts';
export * from './src/types.ts';
export * from './src/registry/registry-index.ts';
export * from './src/error/not-found.ts';
```

**Rules:**
- Only export what consumers need. Internal utilities stay unexported.
- Files in `src/internal/` are never exported via `__index__.ts`.
- Group exports logically (registry, types, utils, errors).

### Private Fields

Use JavaScript private fields (`#field`) for true encapsulation, not TypeScript `private`:

```ts
@Injectable()
export class AuthService {
  #authenticators = new Map<symbol, Promise<Authenticator>>();
  #cache: Record<string, unknown> = {};

  async getAuthenticators(keys: symbol[]): Promise<Authenticator[]> {
    return await Promise.all(keys.map(key => this.#authenticators.get(key)!));
  }
}
```

### Type Utilities

The `@travetto/runtime` module provides core type utilities:

```ts
// Type assertion (safe type cast)
castTo<T>(input: unknown): T

// Partial-to-full assertion
asFull<T>(input: Partial<T>): T

// Class constructor assertion
asConstructable<Z>(input: unknown): { constructor: Class<Z> }

// Type checking
isClass(input: unknown): input is Class

// Resolve interface to concrete class
toConcrete<T>(): Class<T>

// Deep partial type
type DeepPartial<T> = { [P in keyof T]?: ... }

// Core class type
type Class<T = Any> = abstract new (...args: Any[]) => T
```

### Class Identity

All framework-managed classes have a `Ⲑid` property (Coptic letter) assigned by the compiler transformer. This uniquely identifies classes at runtime:

```ts
cls.Ⲑid  // e.g., '@travetto/model:User'
```

Do not create or modify this property manually — it is compiler-assigned.

## Architecture Patterns

### 1. Decorator + Registry Pattern

The foundation of the framework. Decorators register metadata into registry indexes, which are queried at runtime:

```ts
// 1. Define decorator
export function Model(config?: Partial<ModelConfig>) {
  return (target: Class) => {
    ModelRegistryIndex.getForRegister(target).register(config);
  };
}

// 2. Use decorator
@Model({ store: 'users' })
class User { id: string; name: string; }

// 3. Query registry at runtime
const config = ModelRegistryIndex.getConfig(User);
const allModels = ModelRegistryIndex.getClasses();
```

### 2. Dependency Injection

Classes are registered with `@Injectable()` and resolved via `DependencyRegistryIndex`:

```ts
@Injectable()
export class MyService {
  @Inject()
  config: MyConfig;

  @Inject()
  optionalDep?: OtherService;  // Optional injection

  @PostConstruct()
  async init() {
    // Runs after all fields injected
  }
}

// Factory pattern for non-framework classes
class Setup {
  @InjectableFactory()
  static createExternal(): ExternalLib {
    return new ExternalLib();
  }
}

// Qualified injection (multiple implementations)
@InjectableFactory(MY_SYMBOL)
static createSpecific(): MyInterface {
  return new SpecificImpl();
}
```

### 3. Contract/Interface Pattern

Modules define interfaces (contracts) that implementations fulfill:

```ts
// Contract in @travetto/model
export interface ModelCrudSupport extends ModelBasicSupport {
  update<T extends ModelType>(cls: Class<T>, item: T): Promise<T>;
  upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T>;
  list<T extends ModelType>(cls: Class<T>): AsyncIterable<T>;
}

// Implementation in @travetto/model-memory
@Injectable()
export class MemoryModelService implements ModelCrudSupport {
  async update<T extends ModelType>(cls: Class<T>, item: T): Promise<T> { ... }
  async upsert<T extends ModelType>(cls: Class<T>, item: OptionalId<T>): Promise<T> { ... }
  async *list<T extends ModelType>(cls: Class<T>): AsyncIterable<T> { ... }
}
```

Since TypeScript interfaces are erased at runtime, `toConcrete<T>()` bridges the gap by mapping interfaces to marker classes that the DI system can use.

### 4. Error Hierarchy

All framework errors extend `RuntimeError` from `@travetto/runtime`:

```ts
export class RuntimeError<T = Record<string, unknown> | undefined> extends Error {
  type: string;
  category: ErrorCategory;  // 'general' | 'notfound' | 'data' | 'permissions' | 'authentication' | 'timeout' | 'unavailable'
  at: Date;
  details: T;
}

// Module-specific errors
export class ModelNotFoundError extends RuntimeError { ... }
export class ModelExistsError extends RuntimeError { ... }
export class AuthenticationError extends RuntimeError { ... }
```

When defining new errors:
- Extend `RuntimeError` or a module-specific error class.
- Set the appropriate `category` for error classification.
- Attach typed `details` for structured error information.
- Use `cause` for error chaining.

### 5. Configuration Pattern

Configuration classes use `@Config` with schema validation:

```ts
@Config('db.mongo')
export class MongoModelConfig {
  host = 'localhost';
  port = 27017;
  database = 'app';

  @EnvVar('MONGO_URL')
  url?: string;
}
```

Values are resolved from YAML/JSON/properties files in `resources/`, environment variables, and programmatic sources.

### 6. CLI Command Pattern

CLI commands are defined in `support/cli.*.ts` files:

```ts
import { CliCommand } from '@travetto/cli';
import { Schema } from '@travetto/schema';

@CliCommand()
@Schema()
export class MyCommand implements CliCommandShape {
  async main(arg1: string, arg2?: string): Promise<void> {
    // Command logic
  }
}
```

The filename pattern `cli.<command_name>.ts` determines the CLI command name (dots become colons: `cli.model_export.ts` → `trv model:export`).

### 7. Web Interceptor Pattern

Web functionality is layered via interceptors with defined execution categories:

```
global → terminal → pre-request → request → response → application
```

```ts
@Injectable()
export class MyInterceptor implements WebInterceptor {
  category: InterceptorCategory = 'application';

  applies?(endpoint: EndpointConfig): boolean {
    return true;  // Apply to all endpoints
  }

  async filter(ctx: FilterContext): Promise<WebResponse | undefined> {
    // Pre-processing
    const response = await ctx.next();
    // Post-processing
    return response;
  }
}
```

## Naming Conventions

### Files

| Type | Pattern | Example |
|---|---|---|
| Decorator | `decorator.ts` or `decorator/<name>.ts` | `src/decorator/controller.ts` |
| Types/Interfaces | `types.ts` or `types/<feature>.ts` | `src/types/crud.ts` |
| Service | `service.ts` | `src/service.ts` |
| Configuration | `config.ts` | `src/config.ts` |
| Registry index | `registry-index.ts` | `src/registry/registry-index.ts` |
| Registry adapter | `registry-adapter.ts` | `src/registry/registry-adapter.ts` |
| Error | `error.ts` or `error/<name>.ts` | `src/error/not-found.ts` |
| Utility | `util.ts` or `util/<name>.ts` | `src/util/crud.ts` |
| Internal | `internal/<name>.ts` | `src/internal/types.ts` |
| CLI command | `cli.<command>.ts` | `support/cli.model_export.ts` |
| Test suite | `<feature>.ts` | `test/validation.ts` |
| Doc example | `<descriptive-name>.ts` | `doc/injectable-factory.ts` |
| Shared test | `support/test/<feature>.ts` | `support/test/crud.ts` |
| Doc helper | `support/doc.support.tsx` | `support/doc.support.tsx` |

### Classes

| Type | Pattern | Example |
|---|---|---|
| Service | `<Name>Service` | `AuthService`, `CacheService` |
| Configuration | `<Name>Config` | `MongoModelConfig`, `CorsConfig` |
| Error | `<Name>Error` | `ModelNotFoundError`, `InjectionError` |
| Interceptor | `<Name>Interceptor` | `CorsInterceptor`, `LoggingInterceptor` |
| Registry index | `<Name>RegistryIndex` | `ModelRegistryIndex`, `DependencyRegistryIndex` |
| CLI command | `<Name>Command` | `ModelExportCommand` |
| Decorator (as function) | `PascalCase` function | `Injectable()`, `Controller()`, `Model()` |

### Symbols (DI Qualifiers)

```ts
export const CacheModelSymbol = Symbol.for('@travetto/cache:model');
```

## Package Configuration

### `package.json` conventions

```json
{
  "name": "@travetto/<module-name>",
  "version": "8.0.0-alpha.x",
  "type": "module",
  "main": "__index__.ts",
  "files": ["__index__.ts", "src", "support"],
  "dependencies": {
    "@travetto/runtime": "^8.0.0-alpha.x"
  },
  "peerDependencies": {
    "@travetto/cli": "^8.0.0-alpha.x",
    "@travetto/test": "^8.0.0-alpha.x",
    "@travetto/transformer": "^8.0.0-alpha.x"
  },
  "peerDependenciesMeta": {
    "@travetto/cli": { "optional": true },
    "@travetto/test": { "optional": true },
    "@travetto/transformer": { "optional": true }
  },
  "travetto": {
    "displayName": "Human-Readable Module Name"
  },
  "publishConfig": { "access": "public" }
}
```

**Rules:**
- `main` is always `__index__.ts`.
- `files` always includes `__index__.ts`, `src`, and `support`.
- `cli`, `test`, and `transformer` are optional peer dependencies.
- `travetto.displayName` is used by documentation generation.

## Key Module Dependency Hierarchy

```
runtime (foundation — no framework deps)
  └── manifest
  └── registry
        └── di
        └── schema
              └── config
              └── model
                    └── model-memory, model-mongo, model-sql, ...
              └── web
                    └── web-connect, web-http, web-aws-lambda, ...
              └── auth
                    └── auth-web, auth-model, auth-session, ...
  └── compiler
        └── transformer
  └── test
  └── cli
  └── doc
```

`@travetto/runtime` is the only module with zero framework dependencies. All other modules ultimately depend on it.

## `support/` Directory Conventions

The `support/` directory contains framework integration code that is **not part of the module's public API** but is used by the framework infrastructure:

| File Pattern | Purpose |
|---|---|
| `cli.*.ts` | CLI command definitions (auto-discovered) |
| `transformer.*.ts` | Compile-time AST transformers |
| `test/*.ts` | Shared test suites for contract validation |
| `doc.support.tsx` | Reusable documentation components |
| `bin/*.ts` | Support utilities for CLI commands |
| `fixtures/` | Shared test fixture data |

## `doc/` Directory Conventions

The `doc/` directory inside each module contains **runnable example files** referenced by `DOC.tsx`:

```ts
// doc/injectable.ts — referenced via <c.Code src='doc/injectable.ts' />
import { Injectable } from '@travetto/di';

@Injectable()
class CustomService {
  async coolOperation() { }
}
```

These files must be valid, compilable TypeScript and serve as both documentation examples and implicit integration tests.

## Code Style Rules

1. **No `any` in public APIs** — use `unknown` and type narrowing. The codebase defines `Any` as an internal alias used sparingly.
2. **Prefer `async/await`** over raw Promises.
3. **Use `AsyncIterable`/`AsyncGenerator`** for streaming data (e.g., `list()` methods).
4. **Getters with accessors** for lazy/computed properties behind `#private` fields.
5. **No inheritance for services** — composition via DI is strongly preferred. Inheritance is used for shared test suites and error hierarchies.
6. **Consistent error categories** — use `RuntimeError` categories for proper HTTP status mapping.
7. **Keep modules isolated** — each module should be as self-contained as possible. Cross-module dependencies go through public APIs.
8. **`internal/` for non-public code** — implementation details that shouldn't be imported by consumers go in `src/internal/`.
9. **Consistent `from()` pattern** — Schema-decorated classes get a static `from()` method for constructing instances from plain objects.
10. **JSDoc on public APIs** — decorators and services should have JSDoc comments for documentation generation.

## Development Workflow

```bash
# Start compiler in watch mode
trvc start

# Run all tests
npm test

# Run tests for specific module
npm test 'module/model-memory/**'

# Generate documentation
trv doc

# Lint
trv eslint

# Start required services (databases, etc.)
trv service start

# Clean build output
trvc clean
```

## Registry Initialization

Any code that depends on the decorator/registry system must ensure the registry is initialized:

```ts
await Registry.init();
```

This is typically done:
- In `@BeforeAll()` hooks in tests.
- At application startup (handled by the framework entrypoint).
- In `@PostConstruct()` when using DI (registry is already initialized by the time DI runs).
