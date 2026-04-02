# Travetto DOC.tsx Authoring Instructions

Guide for writing and maintaining `DOC.tsx` documentation files across the Travetto framework.

## File Structure

Every `DOC.tsx` file lives at the root of its module directory (e.g., `module/auth/DOC.tsx`) and follows a strict pattern:

```tsx
/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
// Additional imports as needed

export const text = <>
  <c.StdHeader />
  {/* Module documentation content */}
</>;
```

### Key Rules

1. **JSX pragma** — The first line must always be `/** @jsxImportSource @travetto/doc/support */`.
2. **Core imports** — Always import `d` and `c` from `@travetto/doc`. Import `module` from `@travetto/doc` only if you need `module.ModuleName.name` references.
3. **Named export** — The file must export a `const text` which is either:
   - A JSX fragment: `export const text = <>...</>;`
   - An async function returning JSX: `export const text = async () => { return <>...</>; };`
4. **`<c.StdHeader />`** — Must be the first child element. It auto-generates the module title, description, and install instructions from `package.json`.
5. **Optional `wrap` export** — Some root-level docs export a `wrap` object for post-processing rendered output into custom HTML/Markdown shells. Most module docs do not need this.

## Available Components (`c.*`)

### Structural

| Component | Props | Usage |
|---|---|---|
| `c.StdHeader` | `module?: string`, `install?: boolean` | Standard module header (title + description + install). Set `install={false}` to suppress install block. |
| `c.Section` | `title: string` | Top-level section heading. |
| `c.SubSection` | `title: string` | Nested section heading. |
| `c.SubSubSection` | `title: string` | Deeply nested section heading. |
| `c.Note` | _(children only)_ | Highlighted note/callout block. |

### Code & Execution

| Component | Props | Usage |
|---|---|---|
| `c.Code` | `title?: string`, `src: CodeSourceInput`, `language?: string`, `outline?: boolean`, `startRe?: RegExp`, `endRe?: RegExp` | Display source code. `src` can be a file path string, a class/function reference, or a `toConcrete<T>()` result. `outline` shows only the structure. `startRe`/`endRe` limit the displayed range by regex. |
| `c.Config` | Same as `c.Code` | Display configuration files (YAML, JSON, properties). |
| `c.Terminal` | Same as `c.Code` | Display terminal output. |
| `c.Execution` | `title: string`, `cmd: string`, `args?: string[]`, `config?: RunConfig` | Run a command and embed its output. `config` supports `workingDirectory`, `env`, `formatCommand`, `rewrite`. |
| `c.Install` | `title: string`, `pkg: string` | Render install instructions for a package (npm/yarn/pnpm). |

### Linking & References

| Component | Props | Usage |
|---|---|---|
| `c.Ref` | `title: string`, `href: string` | File reference link. |
| `c.Anchor` | `title: string`, `href: string` | In-page anchor. |
| `c.CodeLink` | `title: string`, `src: string`, `startRe: RegExp` | Link to a specific code location. |
| `c.Image` | `title: string`, `href: string` | Image reference. |

## Available Helpers (`d.*`)

### Inline References

These produce styled inline references for use within prose:

| Helper | Purpose | Example |
|---|---|---|
| `d.input('value')` | User input, literal value, or type name | `{d.input('class')}`, `{d.input('true')}` |
| `d.field('name')` | Field/property reference | `{d.field('id')}`, `{d.field('process.env.TRV_ROLE')}` |
| `d.method('name')` | Method/function reference | `{d.method('authenticate')}` |
| `d.class('name')` | Class name reference | `{d.class('DBConfig')}` |
| `d.path('path')` | File path reference | `{d.path('resources/application.yml')}` |
| `d.command('cmd')` | Command reference | `{d.command('trv')}` |

### Cross-References

| Helper | Purpose | Example |
|---|---|---|
| `d.module('Name')` | Link to another Travetto module | `{d.module('Schema')}`, `{d.module('ModelMongo')}` |
| `d.library('Name')` | Link to an external library | `{d.library('Typescript')}`, `{d.library('MongoDB')}` |
| `d.codeLink(title, src, startRe)` | Create a code reference link | `d.codeLink('trvc', 'bin/trvc.js', /#/)` |

### Available Module Names

```
Auth, AuthModel, AuthSession, AuthWeb, AuthWebPassport, AuthWebSession,
Cache, Cli, Compiler, Config, Context, Di, Doc,
Email, EmailCompiler, EmailInky, EmailNodemailer, Eslint,
Image, Log, Manifest,
Model, ModelDynamodb, ModelElasticsearch, ModelFile, ModelFirestore,
ModelMemory, ModelMongo, ModelMysql, ModelPostgres, ModelQuery,
ModelQueryLanguage, ModelRedis, ModelS3, ModelSql, ModelSqlite,
Openapi, Pack, Registry, Repo, Runtime, Scaffold, Schema, SchemaFaker,
Terminal, Test, TodoApp, Transformer, Web, WebAwsLambda
```

### Available Library Names

```
Travetto, Typescript, Javascript, Node, Npm, Yarn, Pnpm, Eslint,
CommonJS, EcmascriptModule, PackageJson, YAML, JSON, Base64,
DependencyInjection, OpenAPI, JSDoc, UUID, JWT,
MongoDB, S3, Redis, Elasticsearch, SQL, MySQL, Postgres,
DynamoDB, Firestore, SQLite, Docker,
Express, Fastify, Koa, Connect, Passport, Busboy,
AwsLambda, NodeConsole, NodeFile, HTML, Markdown, JSX,
NodeMailer, Inky, Sass, Mustache, Sharp, ImageMagick,
Busboy, Fetch, Curl, Preact, NodeYaml
```
_(This is not exhaustive — see `module/doc/src/mapping/library.ts` for the full list.)_

## Using Direct References and `toConcrete<T>()`

### Direct Class/Function References

Import classes, interfaces, decorators, and functions directly, then use them in JSX for automatic inline links:

```tsx
import { IndexedFieldError } from './src/types/indexes.ts';
import { keyedIndex, uniqueIndex } from './src/indexes.ts';
import { Model } from '@travetto/model';

export const text = <>
  The {Model} decorator registers your class. Use {keyedIndex} for efficient lookups.
  
  Errors are thrown as {IndexedFieldError} when validation fails.
</>;
```

This renders as styled, linked references without any wrapper functions.

### Using `toConcrete<T>()` for Interfaces

`toConcrete<T>()` resolves interfaces to their concrete backing classes at runtime. This enables:
- **Displaying interface source** as a code block: `<c.Code src={toConcrete<MyInterface>()} />`
- **Assigning to a variable** for repeated reference: `const MyContract = toConcrete<MyInterface>(); ... {MyContract}`
- **Inline references**: When you use a `toConcrete()` result directly in JSX text (not as a `src` prop), it renders as a styled reference

```tsx
import { toConcrete } from '@travetto/runtime';
import type { ModelIndexedSupport } from './src/types/service.ts';

const ModelIndexedSupportContract = toConcrete<ModelIndexedSupport>();

export const text = <>
  Model services that implement {ModelIndexedSupportContract} provide these operations.
  
  <c.Code
    title='Full Interface Definition'
    src={ModelIndexedSupportContract}
  />
</>;
```

### When to Use Each Approach

| Use Case | Approach | Example |
|---|---|---|
| Concrete classes, functions, decorators | Direct import + JSX reference | `import { Service } from '...'; {Service}` |
| Interfaces with no concrete default | `toConcrete<T>()` | `const MyContract = toConcrete<MyInterface>();` |
| Display interface source in code block | `toConcrete<T>()` as `src` | `<c.Code src={toConcrete<MyInterface>()} />` |
| Inline method/property reference in prose | Use `d.*` helpers | `{d.method('getName')}` |
| Link to external library | Use `d.library()` + `d.module()` | `{d.library('MongoDB')}`, `{d.module('ModelMongo')}` |

## Common Patterns

### Pattern 1: Simple Module (Model Implementation)

```tsx
/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { ModelTypes } from '@travetto/model/support/doc.support.ts';
import { ModelQueryTypes } from '@travetto/model-query/support/doc.support.ts';
import { ModelCustomConfig } from '@travetto/model/support/doc.support.ts';
import { MyModelService } from './src/service.ts';
import { MyModelConfig } from './src/config.ts';

export const text = <>
  <c.StdHeader />
  This module provides a {d.library('SomeDB')}-based implementation for the {d.module('Model')}.

  Supported features:
  <ul>
    {...ModelTypes(MyModelService)}
    {...ModelQueryTypes(MyModelService)}
  </ul>

  <ModelCustomConfig config={MyModelConfig} />
</>;
```

### Pattern 2: Contract-Heavy Module

```tsx
/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { toConcrete } from '@travetto/runtime';
import type { SomeInterface } from './src/types.ts';

const SomeContract = toConcrete<SomeInterface>();

export const text = <>
  <c.StdHeader />
  Overview text referencing {SomeContract}.

  <c.Section title='Core Contract'>
    <c.Code src={SomeContract} title='Main Interface' />
    The {d.method('doSomething')} method is the primary entry point.
  </c.Section>

  <c.Section title='Usage'>
    <c.Code title='Example' src='doc/example.ts' />
  </c.Section>
</>;
```

### Pattern 3: External Code Examples (Recommended)

Prefer this pattern for modules with detailed usage documentation. **Externalize all code examples to the `doc/` folder.**

```tsx
/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { toConcrete } from '@travetto/runtime';
import type { ModelIndexedSupport } from './src/types/service.ts';
import { keyedIndex, uniqueIndex, sortedIndex } from './src/indexes.ts';

const ServiceContract = toConcrete<ModelIndexedSupport>();

export const text = <>
  <c.StdHeader />
  
  This module provides computed index support for fast lookups.

  <c.Section title='Defining Indexes'>
    Use {keyedIndex} to create indexes:

    <c.Code
      title='Creating a Keyed Index'
      src='doc/keyed-index.ts'
    />

    For uniqueness constraints, use {uniqueIndex}:

    <c.Code
      title='Creating a Unique Index'
      src='doc/unique-index.ts'
    />
  </c.Section>

  <c.Section title='Using Indexes'>
    Model services that implement {ServiceContract} provide these operations.

    <c.Code
      title='Service Interface'
      src={ServiceContract}
    />

    <c.Code
      title='Getting an Item'
      src='doc/operations.ts'
      startRe={/export async function getExample/}
    />
  </c.Section>
</>;
```

**Structure for `doc/` folder:**
```
doc/
├── keyed-index.ts      # Define keyed index
├── unique-index.ts     # Define unique index
├── sorted-index.ts     # Define sorted index
├── operations.ts       # Multiple operation examples with startRe extraction
└── ...
```

### Pattern 4: CLI-Focused Module

```tsx
<c.Section title='CLI - command:name'>
  <c.Execution title='CLI Help' cmd='trv' args={['command:name', '--help']}
    config={{ workingDirectory: './doc-exec' }} />
</c.Section>
```

### Pattern 5: Async Text with Runtime Data

```tsx
export const text = async () => {
  const someData = await fetchSomething();
  return <>
    <c.StdHeader />
    {/* Use someData in JSX */}
  </>;
};
```

### Pattern 6: Shared Doc Utilities

Create `support/doc.support.tsx` files for reusable documentation components shared across modules:

```tsx
/** @jsxImportSource @travetto/doc/support */
import { d, type DocJSXElementByFn, DocFileUtil } from '@travetto/doc';
import { Runtime, toConcrete } from '@travetto/runtime';

const toLink = (title: string, target: Function): DocJSXElementByFn<'CodeLink'> =>
  d.codeLink(title, Runtime.getSourceFile(target), new RegExp(`\\binterface\\s+${target.name}`));

export const Links = {
  Basic: toLink('Basic', toConcrete<SomeType>()),
};
```

## Code Source (`src` Prop) Options

The `src` prop on `c.Code` and `c.Config` accepts multiple types of sources:

| Source Type | Example | Behavior |
|---|---|---|
| Relative file path | `'doc/example.ts'` | Reads file from the module directory. **Preferred approach.** |
| Source file path | `'./src/config.ts'` | Reads the actual source file |
| Class/function reference | `{MyClass}` or `src={MyClass}` | Extracts and displays the source of that class/function |
| `toConcrete<T>()` result | `src={toConcrete<MyType>()}` | Extracts the interface source at runtime |
| Direct JSX reference | `{SomeClass}` or `{someFunction}` | Renders as inline reference (not in `src` prop) |

### Narrowing Displayed Code

- `startRe` / `endRe` — Regex patterns to slice the displayed region of a file. Useful for extracting specific functions from larger files.
- `outline` — When `true`, shows only the structural outline (signatures without bodies).

### Example: Using `startRe` for Targeted Extraction

```tsx
<c.Code
  title='Getting Items'
  src='doc/operations.ts'
  startRe={/export async function get/}
  endRe={/^}/}
/>
```

## Externalizing Code Examples

**Best Practice:** Always place code examples in external files under `doc/` rather than using inline template strings.

### Why Externalize?

1. **Type checking** — Code samples compile with the rest of the project
2. **Refactoring safety** — Changes to module code automatically update examples
3. **Maintainability** — Examples stay in sync; no manual string updates
4. **Reusability** — Share examples across modules via imports
5. **Testing** — Run examples as part of your test suite if needed

### How to Externalize

1. Create files in `module/your-module/doc/` folder:
   ```
   doc/
   ├── basic-usage.ts
   ├── advanced-config.ts
   ├── error-handling.ts
   └── ...
   ```

2. Structure files with named exports for fine-grained extraction:
   ```tsx
   // doc/operations.ts
   import { Model } from '@travetto/model';
   
   @Model()
   export class User {
     id: string;
     name: string;
   }
   
   export async function getExample(service: any) {
     const user = await service.getByIndex(User, userIndex, { name: 'John' });
     return user;
   }
   
   export async function updateExample(service: any) {
     return await service.updateByIndex(User, userIndex, { name: 'Jane' });
   }
   ```

3. Reference in DOC.tsx with extraction regex:
   ```tsx
   <c.Code
     title='Getting Items'
     src='doc/operations.ts'
     startRe={/export async function getExample/}
   />
   ```

### Organizing External Files

- **One pattern per file** — `doc/lazy-loading.ts`, `doc/error-handling.ts`
- **Multiple related examples** — Use `startRe`/`endRe` to extract specific functions
- **Model definitions** — Separate file with all model classes used in examples
- **Configuration examples** — `doc/config-advanced.ts`, `doc/config-minimal.ts`

## HTML Elements in JSX

Standard HTML elements are supported inside the JSX fragments:

- `<ul>`, `<ol>`, `<li>` — Lists
- `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>` — Tables
- `<strong>`, `<br />` — Inline formatting
- Use `{...arrayOfElements}` spread syntax for dynamically generated list items or table rows.

## Style & Tone Guidelines

1. **Technical and precise** — Describe what the module does, not marketing copy. Lead with purpose.
2. **Present tense** — "This module provides..." not "This module will provide..."
3. **Reference other modules** — Use `{d.module('Name')}` to cross-link related functionality.
4. **Reference external tech** — Use `{d.library('Name')}` for consistent external links.
5. **Show, don't just tell** — Pair explanations with `<c.Code>` blocks pointing to real source files or external examples.
6. **Use inline references** — Use `d.*` helpers and direct JSX references for field names, methods, inputs, paths, and decorators rather than plain text or backticks.
7. **Section hierarchy** — Use `Section` > `SubSection` > `SubSubSection`. Don't skip levels.
8. **Notes for caveats** — Use `<c.Note>` for important warnings, caveats, or non-obvious behavior.
9. **CLI documentation** — Always include `--help` execution output for CLI commands.
10. **Source file paths** — Code examples should live in external files under `doc/` subdirectories (see "Externalizing Code Examples").

## Best Practices for DOC.tsx

### Always Externalize Code Examples

**Never use inline template strings for code samples.** Always create files in `doc/`:

❌ **Avoid:**
```tsx
<c.Code
  title='Creating an Index'
  language='typescript'
  src={`
import { keyedIndex } from '@travetto/model-indexed';

const idx = keyedIndex(Model, { name: 'idx', key: { id: true } });
  `.trim()}
/>
```

✅ **Do:**
```tsx
<c.Code
  title='Creating an Index'
  src='doc/keyed-index.ts'
/>
```

### Prefer Direct References Over Strings

**Use actual imports and JSX references instead of string names:**

❌ **Avoid:**
```tsx
The {d.method('getByIndex')} method returns a single item.
```

✅ **Do:**
```tsx
import { getByIndex } from './src/service.ts'; // if it's a standalone function
// Or just reference the method directly in prose
The {d.method('getByIndex')} method returns a single item.
```

For classes/decorators/interfaces:

❌ **Avoid:**
```tsx
The {d.class('MyService')} class provides the main functionality.
```

✅ **Do:**
```tsx
import { MyService } from './src/service.ts';
// ...
The {MyService} class provides the main functionality.
```

### Use `toConcrete<T>()` for Interfaces

When documenting interfaces without a single canonical concrete implementation:

```tsx
import { toConcrete } from '@travetto/runtime';
import type { MyInterface } from './src/types.ts';

const MyInterfaceContract = toConcrete<MyInterface>();

export const text = <>
  Services implementing {MyInterfaceContract} must provide:
  
  <c.Code src={MyInterfaceContract} title='Full Interface' />
</>;
```

### Keep DOC.tsx Clean and Focused

- Limit to 200-300 lines maximum
- Import references, don't embed them
- Use `startRe`/`endRe` to extract specific functions from `doc/` files
- Leverage `c.StdHeader` to avoid repeating module metadata

### File Organization

Structure your `doc/` folder logically:

```
doc/
├── models.ts           # All @Model definitions used in examples
├── basic-setup.ts      # Simple getting-started examples
├── advanced-config.ts  # Complex configurations
├── errors.ts           # Error handling examples
├── integration.ts      # Integration patterns
└── ...                 # One file per major pattern/section
```

Use naming to clarify purpose (e.g., `keyed-index.ts`, `sorted-index.ts` rather than `example1.ts`, `example2.ts`).

## Running Documentation Generation

```bash
# Generate markdown output for a module
trv doc

# Generate HTML output
trv doc -o html
```

Modules with a `doc-exec/` subdirectory use it as the working directory for `c.Execution` commands to isolate doc generation side effects.
