# Travetto 8.0 Release Notes

> [!IMPORTANT]
> **Travetto 8.0** is a major release featuring a comprehensive overhaul of `@travetto/model-sql` (migrating from multi-table relational structures to self-contained single-table JSON primitives across MySQL, PostgreSQL, and SQLite), core runtime modernization (TypeScript 6.0, Node 26 compatibility, Temporal API time math), native Node SQLite support, a redesigned linter powered by Biome, binary/codec type unification, CLI & DI decorator overhaul, and enhanced LLM guidance workflows.

---

## Table of Contents
1. [Breaking Changes](#breaking-changes)
2. [Core Framework & Language Updates](#core-framework--language-updates)
3. [Data Modeling & Storage (@travetto/model-*)](#data-modeling--storage-travettomodel-)
4. [CLI & Tooling (@travetto/cli)](#cli--tooling-travettocli)
5. [Linting & Code Quality (@travetto/lint)](#linting--code-quality-travettolint)
6. [LLM Guidance & Integration (@travetto/llm-support)](#llm-guidance--integration-travettollm-support)
7. [Web & RPC (@travetto/web, @travetto/web-rpc)](#web--rpc-travettoweb-travettoweb-rpc)
8. [Dependency Injection (@travetto/di)](#dependency-injection-travettodi)
9. [Compiler, Packing & Publishing (@travetto/compiler, @travetto/pack, @travetto/repo)](#compiler-packing--publishing)
10. [Testing (@travetto/test)](#testing-travettotest)

---

## Breaking Changes

* **SQL Architecture Overhaul (Single-Table JSON Primitives)**: Moved `@travetto/model-sql` and dialect providers (`@travetto/model-mysql`, `@travetto/model-postgres`, `@travetto/model-sqlite`) away from multi-table schema generation and foreign-key joins (`21ad7c5c4c`). SQL backends now store entire model objects as self-contained JSON documents within single tables per model type. Legacy multi-table implementations have been moved to `archived/model-*`.
* **`AppError` Renamed to `RuntimeError`**: `AppError` in `@travetto/runtime` has been renamed to `RuntimeError` (`2da522f741`). Update all error instantiations and `instanceof` checks accordingly.
* **`ExistsError` Renamed to `UniqueError`**: In `@travetto/model`, unique constraint violation exceptions now throw `UniqueError` instead of `ExistsError` (`f17adba1ef`).
* **Model Listing API Returns Batches**: `ModelCrudSupport.list()` and `ModelIndexSupport.listByIndex()` now return async batch iterators instead of single-item streams (`b626e69b23`). Added `batchSizeHint` and `limit` options, as well as `AbortSignal` cancellation support.
* **`@travetto/model-sqlite` Native Driver Migration**: Removed external `better-sqlite3` native C++ dependency in favor of Node's built-in `node:sqlite` module (`54644411a3`).
* **`@travetto/model-s3` Configuration Update**: `hostName` configuration option has been renamed to `publicBaseUrl` with added support for custom localhost endpoints (`99ee3f32d2`).
* **ESLint Replaced by Biome**: `@travetto/lint` migrated its linting and formatting engine from ESLint to Biome (`628a5fe76f`).

---

## Core Framework & Language Updates

* **TypeScript 6.0 Upgrade**: Full codebase and compilation pipeline upgraded to TypeScript 6.0 (`e655fe5954`, `e8a011835a`).
* **Node 26 Compatibility**: Added runtime compatibility checks and polyfills for Node 26 (`0b033a675f`, `fe63a673e2`, `ebbeed16da`).
* **Temporal-Based Time Operations**: Date and time utility calculations in `@travetto/runtime` have been reworked to utilize native `Temporal` API concepts (`3669d17032`).
* **Binary & Codec Unification**:
  * Unified binary types across all modules (`6f231a57c9`).
  * Created an isolated `Blob` implementation (`4b40ff3033`).
  * Streamlined binary streaming and aligned encoders/decoders (`d151660fb2`, `43932e2564`).
  * Optimized buffer allocations by reducing unnecessary `toBuffer()` calls (`f328a4bdef`).

---

## Data Modeling & Storage (`@travetto/model-*`)

### Major Architecture Change: SQL Migration to Self-Contained JSON Documents (`@travetto/model-sql`)
* **Single-Table JSON Primitive Engine**: Complete rewrite of `@travetto/model-sql` (`21ad7c5c4c`). Instead of managing normalized relational sub-tables and joins for complex nested structures, models are now saved as self-contained JSON documents inside single primary tables per entity type.
* **Multi-Dialect JSON Support**: Native JSON functions/queries were implemented across MySQL, PostgreSQL, and SQLite (`@travetto/model-mysql`, `@travetto/model-postgres`, `@travetto/model-sqlite`).
* **Archived Legacy Relational Engine**: The previous multi-table relational implementations were moved to `archived/model-sql`, `archived/model-mysql`, `archived/model-postgres`, and `archived/model-sqlite`.

### SQL Query Engine Features
* **Nested Array Property Queries**: Query engine now supports querying nested array properties across all SQL dialects (`f0e93e4505`).
* **Array Field Regex Support**: Added regex matching capabilities on array fields (`7536c46767`).

### Firestore & Elasticsearch Enhancements
* **Firestore (`@travetto/model-firestore`)**: Added schema export CLI tool for composite index creation (`4e919411e6`, `ab8ad81f6c`) and optimized bulk delete operations (`49b0b76bca`).
* **Elasticsearch (`@travetto/model-elasticsearch`)**: Fixed schema detection and query resolution behaviors (`3a59fd6167`, `c11ae98b06`).

### Query Engine & Indexing
* **Dotted Path Property Access**: Query engine now natively supports nested dotted property paths (`4c3d9c2643`).
* **First-Class Index Support**: Refactored index definition and lookup into first-class Citizens (`cba2ae0432`, `9b40fe5a87`).
* **Indexed Model Queries (`@travetto/model-indexed`)**: Added support for prefix queries, ID checks, and full scans (`35a85b245d`, `914f85a2e7`).

---

## CLI & Tooling (`@travetto/cli`)

* **CLI Architecture Overhaul**: Streamlined CLI execution pipeline and command registration (`27d12cc476`, `c07849e955`, `6efdd36836`).
* **JSDoc & `CliHelp` Integration**: Migrated module CLI documentation to `CliHelp` and improved help message formatting (`b74fb73bf9`, `009ae2d870`).
* **Fixes & Enhancements**: Improved short flag parsing (`fc4195ff16`), default run target handling (`7365b2a4a8`), and BigInt support in schema export (`f5e8f44e1a`).

---

## Linting & Code Quality (`@travetto/lint`)

* **Biome Engine Migration**: Replaced ESLint with Biome for faster formatting and linting (`628a5fe76f`, `2a998b26f1`).
* **Enforced Async/Await**: Added lint rules enforcing `await` keywords on promise-returning functions (`528c49b6c6`).

---

## LLM Guidance & Integration (`@travetto/llm-support`)

* **Guidance Workflows & Snippets**: Added LLM guidance workflows, snippets, and project bootstrap integration (`02e523e83a`).
* **Auto-generated Prompt Files**: Automatically builds and injects `.agents/AGENTS.md` and `.cursorrules` during project bootstrapping (`0bf19fc21c`).

---

## Web & RPC (`@travetto/web`, `@travetto/web-rpc`)

* **Parent Controller Path Parameters**: Controller routing now allows path parameters defined on parent class controllers (`280d8a19b3`).
* **Web RPC Redirect Support**: Added native support for HTTP redirects directly from RPC controller methods (`9b989f6efd`, `a170eb7ea8`).
* **Empty Body Handling**: Client RPC generator now gracefully handles empty body HTTP responses (`654ae8f6fe`).
* **Expanded HTTP Method Support**: Updated RPC controller mapping to support additional HTTP request methods by default (`a332317d63`).

---

## Dependency Injection (`@travetto/di`)

* **Decorator-based `@PostConstruct` Registration**: Reworked post-construct lifecycle execution to use explicit decorators (`0f633541a7`, `b848835687`).

---

## Compiler, Packing & Publishing

* **Compiler (@travetto/compiler)**: Updated compiler pipeline (`7a3b2e1313`), added watcher success notifications (`1e77130093`), and improved generic type resolution to concrete types (`0b3a0b2481`).
* **Packaging (@travetto/pack)**: Fixed sourcemap generation for bundled applications (`99df989f17`).
* **Publishing (@travetto/repo)**: Added interactive 2FA/OTP token prompt and npm auth verification before publishing releases (`0f101b106f`, `7378c9a0aa`).

---

## Testing (`@travetto/test`)

* **Execution Cleanup**: Improved test execution harness, watch mode persistence (`c046c56ff9`), and error handling (`ea6d469014`, `c00a8f8e9e`).
* **Formatted Assertions & Output**: Updated file line mapping for cleaner stack trace output (`07e324d2dc`) and updated summary styling (`009ae2d870`).
