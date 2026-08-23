# Travetto 8.0.0 Release: SQL Re-imagined, Native SQLite, Biome Linting & TypeScript 6.0

## What's Changed

**Travetto 8.0.0** is a landmark release focused on storage modernization, runtime performance, developer tooling speed, and seamless AI/LLM integration. This version overhauls the SQL storage model, removes native C++ build dependencies, migrates linting infrastructure to Biome, upgrades to TypeScript 6.0, and unifies binary primitives across the framework.

---

### SQL Architecture Overhaul: Single-Table JSON Primitives

The biggest shift in 8.0 is a complete re-architecting of `@travetto/model-sql` and its database providers (`@travetto/model-mysql`, `@travetto/model-postgres`, and `@travetto/model-sqlite`). 

Historically, relational models relied on multi-table schema generation, foreign keys, and complex `JOIN` queries for nested structures and array fields. While idiomatic for traditional SQL, this approach introduced significant schema management overhead and performance bottlenecks for complex object graphs.

With 8.0, the SQL model framework migrates to **self-contained single-table JSON primitives**. Entire entity hierarchies and nested structures are saved as native JSON documents within single tables per model type, querying directly via native SQL JSON functions. 

This brings several key benefits:
* **Zero Multi-Table Migration Friction**: Tables no longer require secondary join tables for sub-structures or array fields.
* **Unified Document & Query Semantics**: Combines document-database flexibility with ACID SQL transaction guarantees.
* **Native JSON Query Engine**: Full support for nested array queries, dotted path lookups, and regex filtering directly within SQL dialects.

The legacy multi-table relational engine has been archived under `archived/model-*` for historical reference.

---

### First-Class Indexing & `ModelIndexed` Overhaul (`@travetto/model-indexed`)

Indexing has been extracted and rebuilt into a **first-class framework citizen** via `@travetto/model-indexed`. 

In previous versions, structured indexing was tightly coupled to full ad-hoc query support (`@travetto/model-query`). Key-value and document stores with restricted query capabilities (such as DynamoDB, Firestore, Redis, and Memory) often struggled to participate cleanly in non-primary-key queries.

In 8.0, `@travetto/model-indexed` provides a standalone `ModelIndexSupport` contract, introducing powerful searching mechanics across all index-enabled providers:
* **Index Mutation Operations**: Added `updateByIndex()` and `updateByPartialIndex()` to mutate records directly via secondary index keys without requiring a primary key lookup first.
* **Paginated & Prefix Index Searching**: Added `pageByIndex()` and `pageByIndexWithFilter()` alongside native **prefix query matching** across indexed fields.
* **Batch Iteration & Cancellation**: Reworked `listByIndex()` to stream results in configurable batches (`batchSizeHint` and `limit`) with built-in `AbortSignal` cancellation support for long-running scans.
* **Bidirectional Indexes**: Native support for bi-directional index lookups and ID checks across DynamoDB, Firestore, Redis, Elasticsearch, Mongo, and SQL providers.

---

### Native Node SQLite Driver Migration

In `@travetto/model-sqlite`, we have completely replaced the external `better-sqlite3` native C++ dependency with Node's built-in `node:sqlite` module.

By relying on Node's native SQLite driver:
* **Zero Native Compilation**: Eliminates `node-gyp` build errors and native compilation delays during `npm install`.
* **Lighter Installs**: Drastically reduces dependency weight and container image sizes.
* **Cross-Platform Simplicity**: Smooth out-of-the-box development on macOS, Linux, and Windows without binary matching issues.

---

### Linting & Formatting Speedup with Biome (`@travetto/lint`)

As part of our commitment to developer ergonomics and fast build cycles, **`@travetto/eslint` has been deprecated** in favor of the new **`@travetto/lint`** module powered by **Biome**.

Biome provides near-instantaneous linting and code formatting across the entire monorepo and user projects. In addition to sub-millisecond execution times:
* **Deprecation of `@travetto/eslint`**: `@travetto/eslint` is now deprecated; all linting and formatting capabilities are unified under `@travetto/lint`.
* **Unified Formatting & Linting**: Single tool for both formatting and static code analysis without needing complex ESLint plugins.
* **Enforced Promises**: Automatically enforces `await` keywords on promise-returning functions.
* **Simplified Configuration**: Replaces fragmented ESLint rules with a clean, centralized setup.

---

### Core Runtime Modernization: TypeScript 6.0 & Node 26

Travetto 8.0 stays at the cutting edge of the Node.js and TypeScript ecosystems:
* **TypeScript 6.0**: The entire compilation pipeline, transformers, and framework core have been upgraded to TypeScript 6.0.
* **Node 26 Compatibility**: Runtime checks, polyfills, and module resolution have been updated for Node 26.
* **Temporal API Integration**: Date and time utility math in `@travetto/runtime` has been refactored to align with native `Temporal` API standards.
* **Binary & Codec Unification**: Unified binary handling (`Blob` / `ReadableStream`) across `runtime`, `model`, and `web`, eliminating redundant `toBuffer()` memory conversions.

---

### Built-in LLM Guidance & AI Pair-Programming Integration

To support modern AI-assisted development, `@travetto/llm-support` now natively embeds guidance workflows directly into the project lifecycle.

During project bootstrapping (`npx @travetto/scaffold`), Travetto automatically generates `.agents/AGENTS.md` tailor-made for your project structure. This provides AI coding assistants (such as Antigravity, Cursor, and Copilot) with exact framework conventions, routing rules, and decorator context out of the box.

---

### Web & RPC Enhancements

* **Native RPC Redirects**: Web RPC controller methods can now trigger browser redirects directly from method returns.
* **Parent Controller Path Parameters**: Controller routes now inherit and resolve path parameters defined on base controller classes.
* **Decorator-based DI `@PostConstruct`**: Reworked dependency injection lifecycle execution to use explicit `@PostConstruct` decorators.
* **CLI Improvements**: Streamlined command execution pipeline with integrated `CliHelp` rendering.

---

## What's Next?

As we look beyond 8.0, our roadmap focuses on further optimizing startup times and tracking major upstream platform evolutions:

* **TypeScript 7 & Native Tooling**: We continue to closely monitor TypeScript's migration toward a Go-based core in version 7+. We are preparing for the evolution of custom AST transformers into native Go-based tools or standard WASM plugins.
* **TC39 Standard Decorators**: As native JavaScript TC39 parameter decorators and standalone function decorators stabilize, we will continue migrating framework decorator semantics toward standard JS primitives.
* **Deeper Agentic Workflows**: We will continue expanding `@travetto/llm-support` with automated code generation recipes, AST-aware refactoring tools, and interactive CLI diagnostic assistants.
