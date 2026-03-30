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

## Using `toConcrete<T>()`

Import from `@travetto/runtime`. This resolves an interface/type to its concrete backing class at runtime, enabling:
- **Displaying interface source** as a code block: `<c.Code src={toConcrete<MyInterface>()} />`
- **Assigning to a variable** for repeated reference: `const MyContract = toConcrete<MyInterface>(); ... {MyContract}`

When you use a `toConcrete` result directly inside JSX text (not as a `src` prop), it renders as an inline reference to that type.

## Referencing Decorators and Classes Directly

Import decorators/classes and use them as JSX expressions. They render as styled, linked references:

```tsx
import { Schema } from './src/decorator/schema.ts';
import { Injectable } from '@travetto/di';

// In JSX:
The {Schema} decorator registers the class. It requires {Injectable} support.
```

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

### Pattern 3: CLI-Focused Module

```tsx
<c.Section title='CLI - command:name'>
  <c.Execution title='CLI Help' cmd='trv' args={['command:name', '--help']}
    config={{ workingDirectory: './doc-exec' }} />
</c.Section>
```

### Pattern 4: Async Text with Runtime Data

```tsx
export const text = async () => {
  const someData = await fetchSomething();
  return <>
    <c.StdHeader />
    {/* Use someData in JSX */}
  </>;
};
```

### Pattern 5: Shared Doc Utilities

Create `support/doc.support.tsx` files for reusable documentation components shared across modules:

```tsx
/** @jsxImportSource @travetto/doc/support */
import { d, type DocJSXElementByFn, type DocJSXElement, DocFileUtil } from '@travetto/doc';
import { Runtime, toConcrete } from '@travetto/runtime';

const toLink = (title: string, target: Function): DocJSXElementByFn<'CodeLink'> =>
  d.codeLink(title, Runtime.getSourceFile(target), new RegExp(`\\binterface\\s+${target.name}`));

export const Links = {
  Basic: toLink('Basic', toConcrete<SomeType>()),
};
```

## Code Source (`src` Prop) Options

The `src` prop on `c.Code` and `c.Config` accepts:

| Source Type | Example | Behavior |
|---|---|---|
| Relative file path | `'doc/example.ts'` | Reads file from the module directory |
| Source file path | `'./src/config.ts'` | Reads the actual source file |
| Class/function reference | `{MyClass}` or `src={MyClass}` | Extracts the source of that class |
| `toConcrete<T>()` result | `src={toConcrete<MyType>()}` | Extracts the interface source |

### Narrowing Displayed Code

- `startRe` / `endRe` — Regex patterns to slice the displayed region of a file.
- `outline` — When `true`, shows only the structural outline (signatures without bodies).

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
5. **Show, don't just tell** — Pair explanations with `<c.Code>` blocks pointing to real source files.
6. **Use inline references** — Wrap field names, methods, inputs, and paths in the appropriate `d.*` helpers rather than plain text or backticks.
7. **Section hierarchy** — Use `Section` > `SubSection` > `SubSubSection`. Don't skip levels.
8. **Notes for caveats** — Use `<c.Note>` for important warnings, caveats, or non-obvious behavior.
9. **CLI documentation** — Always include `--help` execution output for CLI commands.
10. **Source file paths** — Code examples should live in `doc/` subdirectories within the module, or reference actual source files.

## Running Documentation Generation

```bash
# Generate markdown output for a module
trv doc

# Generate HTML output
trv doc -o html
```

Modules with a `doc-exec/` subdirectory use it as the working directory for `c.Execution` commands to isolate doc generation side effects.
