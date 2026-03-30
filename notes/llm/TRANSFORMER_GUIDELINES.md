# Transformer Guidelines

This document provides a comprehensive overview of the `@travetto/transformer` module and the conventions for writing compile-time AST transformers in the Travetto framework.

---

## Overview

The `@travetto/transformer` module provides a compile-time AST transformation framework built on top of the TypeScript compiler API. It allows modules to register transformers that modify TypeScript source code during compilation — injecting metadata, rewriting imports, instrumenting function calls, and augmenting decorator-driven class definitions.

Transformers are **not** runtime code. They execute during the compilation phase and produce modified TypeScript AST output. The framework ensures all transformers run in a single pass over each source file.

---

## Architecture

### Compilation Pipeline

1. **Discovery**: The `TransformerManager` loads all files from the `$transformer` manifest folder (i.e., files matching `support/transformer.*` in each module).
2. **Registration**: Each transformer file exports a class that registers handler methods via `TransformerHandler()` in a `static {}` block.
3. **Initialization**: The manager creates a `VisitorFactory` with the collected transformers and a `TypeChecker`.
4. **Execution**: For each source file, the visitor walks the AST. At each node, it:
   - Determines the node type (`class`, `method`, `property`, `call`, `file`, etc.)
   - Runs `before` phase handlers (both untargeted and decorator-targeted)
   - Recursively visits child nodes
   - Runs `after` phase handlers (both untargeted and decorator-targeted)
5. **Finalization**: Added statements are inserted, imports are resolved, and the modified source file is emitted.

### Key Classes

| Class | Purpose |
|---|---|
| `TransformerManager` | Loads transformer files from manifest, creates `VisitorFactory` |
| `VisitorFactory` | Combines all transformers into a single-pass AST visitor |
| `TransformerState` | Per-file state providing the full API for transformations |
| `ImportManager` | Tracks and manages imports within a source file |
| `SimpleResolver` | Resolves TypeScript types to the framework's `AnyType` system |

### Node Types

The visitor recognizes these AST node types (the `TransformerType` union):

| Type | TypeScript Node |
|---|---|
| `class` | `ts.ClassDeclaration` |
| `method` | `ts.MethodDeclaration` (non-static) |
| `static-method` | `ts.MethodDeclaration` (static) |
| `property` | `ts.PropertyDeclaration` |
| `getter` | `ts.GetAccessorDeclaration` |
| `setter` | `ts.SetAccessorDeclaration` |
| `constructor` | `ts.ConstructorDeclaration` |
| `parameter` | `ts.ParameterDeclaration` |
| `call` | `ts.CallExpression` |
| `function` | `ts.FunctionDeclaration` / `ts.FunctionExpression` |
| `file` | `ts.SourceFile` |
| `interface` | `ts.InterfaceDeclaration` |
| `type` | `ts.TypeAliasDeclaration` |

---

## File Conventions

### Naming and Location

- Transformer files **must** be placed in a module's `support/` directory.
- Files **must** match the pattern `support/transformer.*.ts` (e.g., `support/transformer.schema.ts`).
- The manifest system maps `support/transformer.*` files to the `$transformer` folder key, which is how the `TransformerManager` discovers them.
- Helper utilities used by a transformer should go in `support/transformer/*.ts` (a subdirectory), not in the transformer file itself.

### Examples in the Codebase

| File | Module | Purpose |
|---|---|---|
| `support/transformer.function-metadata.ts` | `@travetto/runtime` | Registers class/function metadata (hash, line ranges) |
| `support/transformer.concrete-type.ts` | `@travetto/runtime` | Resolves `toConcrete<T>()` calls and `@concrete` interfaces |
| `support/transformer.console-log.ts` | `@travetto/runtime` | Rewrites `console.*` calls to framework logging with source location |
| `support/transformer.debug-method.ts` | `@travetto/runtime` | Injects conditional `debugger` statements into `@DebugBreak` methods |
| `support/transformer.dynamic-import.ts` | `@travetto/runtime` | Normalizes dynamic `import()` module specifiers |
| `support/transformer.rewrite-path-import.ts` | `@travetto/runtime` | Rewrites `node:path`/`path` imports to `@travetto/manifest/src/path.ts` |
| `support/transformer.schema.ts` | `@travetto/schema` | Processes `@Schema` classes — registers fields, types, methods |
| `support/transformer.assert.ts` | `@travetto/test` | Instruments `assert()` calls in test methods for rich error reporting |

---

## Writing a Transformer

### Basic Structure

Every transformer is a class with:
1. A `static {}` block that calls `TransformerHandler()` to register handler methods.
2. Static handler methods that receive `TransformerState` and a `ts.Node`, and return the (possibly modified) node.

```typescript
import type ts from 'typescript';
import { type TransformerState, TransformerHandler } from '@travetto/transformer';

export class MyTransformer {

  static {
    // Register handlers: (class, method, phase, nodeType, targets?)
    TransformerHandler(this, this.handleClass, 'before', 'class');
    TransformerHandler(this, this.handleMethod, 'after', 'method');
  }

  static handleClass(state: TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
    // Transform the class node
    return node;
  }

  static handleMethod(state: TransformerState, node: ts.MethodDeclaration): ts.MethodDeclaration {
    // Transform the method node
    return node;
  }
}
```

### TransformerHandler Registration

```typescript
TransformerHandler(cls, fn, phase, type, target?)
```

| Parameter | Type | Description |
|---|---|---|
| `cls` | class | The transformer class (always `this` in `static {}`) |
| `fn` | `Function` | The static handler method to invoke |
| `phase` | `'before' \| 'after'` | Whether to run before or after child visit |
| `type` | `TransformerType` | Which AST node type triggers this handler |
| `target` | `string[]` (optional) | Decorator names to target (see Targeting below) |

### Phases: Before vs After

- **`before`**: Handler runs before the node's children are visited. Use this to:
  - Collect information on descent (e.g., track current class name)
  - Set per-scope state flags
  - Modify the node before children are processed

- **`after`**: Handler runs after the node's children have been visited. Use this to:
  - Finalize accumulated information (e.g., emit metadata after all methods collected)
  - Modify the node with knowledge of fully-processed children
  - Clean up per-scope state

A common pattern is pairing `before` and `after` on the same node type to bracket a scope:

```typescript
static {
  TransformerHandler(this, this.enterClass, 'before', 'class');
  TransformerHandler(this, this.collectMethod, 'before', 'method');
  TransformerHandler(this, this.leaveClass, 'after', 'class');
}
```

### Targeting: Untargeted vs Decorator-Targeted

**Untargeted handlers** (no `target` parameter) run on **every** node of the specified type. They are registered under the `__all__` key internally. Examples:
- `console.log` rewriting (runs on every `call` expression)
- Dynamic import normalization (runs on every `call` expression)
- File-level transformations (runs on every `file`)

**Decorator-targeted handlers** (with `target` parameter) only run on nodes decorated with specific decorators. The target strings are matched against the decorator's `@augments` JSDoc tags. Examples:
- `TransformerHandler(this, this.startSchema, 'before', 'class', ['Schema'])` — only runs on classes with decorators that have `@augments \`@travetto/schema:Schema\`` in their JSDoc.
- `TransformerHandler(this, this.debugOnEntry, 'before', 'method', ['DebugBreak'])` — only runs on methods with `@DebugBreak`-augmented decorators.

### The @augments Convention

The decorator-targeting system works through JSDoc `@augments` tags on decorator functions:

```typescript
// In @travetto/schema/src/decorator/schema.ts
/**
 * Register a class as a Schema
 *
 * @augments `@travetto/schema:Schema`
 */
export function Schema(config?) { ... }
```

When the transformer encounters a class decorated with `@Schema`, it reads the `@augments` tags to produce target strings like `@travetto/schema:Schema`. The `TransformerHandler` target `['Schema']` is prefixed with the module name at registration time, so it becomes `@travetto/schema:Schema` and matches.

### The @example Convention

Decorators can also carry `@example` JSDoc tags that are read as options at transformation time:

```typescript
/**
 * @augments `@travetto/schema:Schema`
 * @example opt-in
 * @example method:validate
 */
export function Schema(config?) { ... }
```

The transformer can access these options via `DecoratorMeta.options` when processing the node. This is used by the schema transformer to determine whether a class uses opt-in field registration or which methods should be auto-enrolled.

---

## TransformerState API

The `TransformerState` object is the primary interface for transformer implementations. It is created per source file and provides:

### Properties

| Property | Type | Description |
|---|---|---|
| `source` | `ts.SourceFile` | The current source file being transformed |
| `factory` | `ts.NodeFactory` | TypeScript's node factory for creating AST nodes |
| `importName` | `string` | The module import path of the current file (e.g., `@travetto/schema/src/decorator/schema.ts`) |
| `file` | `string` | Physical file path |
| `added` | `Map<number, ts.Statement[]>` | Statements queued for insertion |

### Creating Nodes

| Method | Description |
|---|---|
| `fromLiteral(value)` | Convert a JS literal (string, number, boolean, object, array, RegExp, null, undefined) to a `ts.Node` |
| `extendObjectLiteral(source, ...rest)` | Merge object literals together |
| `createAccess(first, second, ...items)` | Create property access chains (e.g., `obj.prop.sub`) |
| `createStaticField(name, value)` | Create a static property declaration |
| `createIdentifier(name)` | Create a `ts.Identifier` |
| `createDecorator(location, name, ...args)` | Create a decorator expression (also imports the decorator) |

### Import Management

| Method | Description |
|---|---|
| `importFile(path)` | Import a file and get its `Import` reference (with `.identifier`) |
| `getOrImport(type)` | Get an identifier for a resolved type, importing if needed |
| `importDecorator(location, name)` | Import a decorator function |
| `normalizeModuleSpecifier(specifier)` | Rewrite a module specifier to its canonical form |
| `getModuleIdentifier()` | Get the current file's module identifier (for metadata) |

### Type Resolution

| Method | Description |
|---|---|
| `resolveType(node)` | Resolve a `ts.Node` to an `AnyType` |
| `resolveReturnType(node)` | Resolve the return type of a method |
| `getConcreteType(node)` | Get the concrete runtime type expression for a type parameter |
| `getApparentTypeOfField(node)` | Get the apparent type of a field |

### Statement Management

| Method | Description |
|---|---|
| `addStatements(statements, before?)` | Queue statements for insertion into the file. If `before` is a node, inserts before that node's top-level statement. If omitted, appends at the end. |
| `finalize(source)` | Finalize imports and return the modified source file |

### Decorator Inspection

| Method | Description |
|---|---|
| `getDecoratorList(node)` | Get all `DecoratorMeta` for a node |
| `findDecorator(input, node, name, module?)` | Find a specific decorator on a node by name and optional module path |
| `getDecoratorMeta(decorator)` | Read full metadata from a decorator (identifier, file, module, targets, options) |

### Node Inspection

| Method | Description |
|---|---|
| `getDeclarations(node)` | Get all declarations for a node's type |
| `findMethodByName(cls, name)` | Find a method declaration by name in a class |
| `buildClassId(node)` | Build a unique class identifier string |
| `generateUniqueIdentifier(node, type, suffix?)` | Generate a unique identifier for synthetic nodes |
| `registerIdentifier(id)` | Register a synthetic identifier, returns `[identifier, alreadyExists]` |
| `readDocTag(type, name)` | Read JSDoc tags from a type |

---

## Type System

The transformer module includes a type resolution system that converts TypeScript types into a framework-specific type hierarchy (`AnyType`). This is critical for transformers like `@Schema` that need to understand field types at compile time.

### AnyType Variants

| Key | Type | Description |
|---|---|---|
| `managed` | `ManagedType` | A class/type importable from the project (has `importName`) |
| `shape` | `ShapeType` | A structurally-defined type (interface with `fieldTypes`) |
| `literal` | `LiteralType` | A literal type with a constructor reference (`String`, `Number`, `Array`, etc.) |
| `template` | `TemplateType` | A template literal type |
| `composition` | `CompositionType` | A union or intersection type (has `subTypes`) |
| `tuple` | `TupleType` | A tuple type (has `subTypes`) |
| `mapped` | `MappedType` | A mapped type (Omit, Pick, Partial, Required) |
| `pointer` | `PointerType` | A recursive reference (prevents infinite loops) |
| `foreign` | `ForeignType` | A type outside the framework's management |
| `unknown` | `UnknownType` | An unknown or any type |

Each type variant can carry:
- `name`: Display name
- `comment`: JSDoc description
- `undefinable`: Whether the type can be undefined
- `nullable`: Whether the type can be null
- `original`: The original `ts.Type` for back-reference

---

## Extending State with Symbols

Transformers often need to track per-file or per-scope state beyond what `TransformerState` provides. The convention is to use `Symbol` keys on the state object via an intersection type:

```typescript
const MySymbol = Symbol();

interface MyState {
  [MySymbol]?: SomeData;
}

export class MyTransformer {
  static {
    TransformerHandler(this, this.onClass, 'before', 'class');
  }

  static onClass(state: TransformerState & MyState, node: ts.ClassDeclaration): ts.ClassDeclaration {
    state[MySymbol] = { /* collected data */ };
    return node;
  }
}
```

This pattern is used extensively:
- `ConsoleLogTransformer` tracks a `scope` stack for nested class/method/function names
- `RegisterTransformer` accumulates class and method metadata hashes
- `AssertTransformer` tracks whether the current method is inside a test
- `SchemaTransformer` tracks whether it's inside a `@Schema` class and which accessors have been processed

---

## Common Patterns

### 1. Self-Exclusion

Many transformers exclude their own source files from transformation to avoid circular issues:

```typescript
static handleClass(state: TransformerState, node: ts.ClassDeclaration): ts.ClassDeclaration {
  if (state.importName === '@travetto/runtime/src/function.ts') {
    return node; // Don't transform self
  }
  // ... transform
}
```

The `MetadataRegistrationUtil.isValid(state)` helper encapsulates this check for the metadata transformer.

### 2. Scope Tracking with Before/After

Track nested scopes by pushing on `before` and popping on `after`:

```typescript
static startClass(state: CustomState, node: ts.ClassDeclaration): typeof node {
  state.scope.push({ type: 'class', name: node.name?.text ?? 'unknown' });
  return node;
}

static leaveClass(state: CustomState, node: ts.ClassDeclaration): typeof node {
  state.scope.pop();
  return node;
}
```

### 3. Collecting Then Emitting

Collect information in `before` handlers on child nodes, then emit the aggregate in an `after` handler on the parent:

```typescript
// before: class → initialize collection
// before: method → collect method metadata
// after: class → emit all collected metadata
static {
  TransformerHandler(this, this.collectClassMetadata, 'before', 'class');
  TransformerHandler(this, this.collectMethodMetadata, 'before', 'method');
  TransformerHandler(this, this.registerClassMetadata, 'after', 'class');
}
```

### 4. Decorator Splicing

Replace or add decorators on a node using `DecoratorUtil.spliceDecorators`:

```typescript
const existing = state.findDecorator(this, node, 'Schema', SCHEMA_IMPORT);
const params = DecoratorUtil.getArguments(existing) ?? [];

return state.factory.updateClassDeclaration(
  node,
  DecoratorUtil.spliceDecorators(node, existing, [
    state.createDecorator(SCHEMA_IMPORT, 'Schema', ...params)
  ]),
  node.name, node.typeParameters, node.heritageClauses, node.members
);
```

### 5. Adding Statements to the File

Use `state.addStatements()` to inject new top-level statements:

```typescript
const func = state.factory.createFunctionDeclaration(/* ... */);
state.addStatements([func]); // Appended at end
state.addStatements([expr], node); // Inserted before `node`'s top-level statement
```

### 6. Call Expression Interception

Target `call` node type to intercept specific function calls:

```typescript
static {
  TransformerHandler(this, this.onCall, 'before', 'call');
}

static onCall(state: TransformerState, node: ts.CallExpression): typeof node {
  if (ts.isIdentifier(node.expression) && node.expression.text === 'toConcrete') {
    // Rewrite the call
    return state.factory.updateCallExpression(node, node.expression, node.typeArguments, [newArg]);
  }
  return node;
}
```

### 7. File-Level Transformation

Target `file` to transform the entire source file:

```typescript
static {
  TransformerHandler(this, this.rewriteImport, 'before', 'file');
}

static rewriteImport(state: TransformerState, node: ts.SourceFile): ts.SourceFile {
  // Inspect and modify top-level statements
  return state.factory.updateSourceFile(node, modifiedStatements);
}
```

---

## Utility Classes

The transformer module provides several utility classes importable from `@travetto/transformer`:

| Utility | Key Methods |
|---|---|
| `CoreUtil` | `createAccess`, `createDecorator`, `createStaticField`, `isAbstract`, `getRangeOf`, `firstArgument` |
| `DeclarationUtil` | `isPublic`, `isStatic`, `isConstantDeclaration`, `getDeclarations`, `getAccessorPair` |
| `DecoratorUtil` | `getDecoratorIdentifier`, `spliceDecorators`, `getPrimaryArgument`, `getArguments` |
| `DocUtil` | `describeDocs`, `readDocTag`, `hasDocTag`, `readAugments`, `getDocComment` |
| `LiteralUtil` | `fromLiteral`, `toLiteral`, `extendObjectLiteral`, `isLiteralType`, `templateLiteralToRegex` |
| `SystemUtil` | `naiveHash`, `naiveHashString` |

---

## Dependency Configuration

Modules that provide transformers must declare `@travetto/transformer` as a **peer dependency** (optional):

```json
{
  "peerDependencies": {
    "@travetto/transformer": "^8.0.0-alpha.4"
  },
  "peerDependenciesMeta": {
    "@travetto/transformer": {
      "optional": true
    }
  }
}
```

The transformer module itself has `"roles": ["compile"]` in its travetto config, indicating it's only active during compilation.

---

## Important Constraints

1. **Transformer files are excluded from transformation**: Files in `@travetto/compiler`, `@travetto/manifest`, and `@travetto/transformer` (in `src`, `support`, or `$index` folders) are skipped by the visitor to avoid bootstrapping issues.

2. **Files can opt out**: A source file starting with `// @trv-no-transform` will be skipped entirely.

3. **Return the node**: Handler methods must always return a node (the original or modified). Returning `undefined` is treated as "keep the original node."

4. **Single pass**: All transformers run in a single AST walk. Order within a phase is determined by registration order. Design handlers to be independent or use state symbols to coordinate.

5. **Type imports**: The `import type ts from 'typescript'` pattern should be used when the transformer only needs TypeScript types (not runtime values). Use `import ts from 'typescript'` when you need runtime access to `ts.SyntaxKind` or similar.

6. **Synthetic nodes**: When creating new AST nodes (classes, functions, etc.) that should be treated as if they exist in source, use `state.addStatements()` so they get properly visited and finalized.
