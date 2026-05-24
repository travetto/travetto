# Doc Overview
The @travetto/doc module provides JSX-driven documentation generation for markdown and HTML outputs.

## What This Module Is
This module offers document authoring primitives and CLI execution to generate framework-aware docs from code-linked content.

## Why To Use It
- It keeps documentation synchronized with source references.
- It supports reusable JSX nodes for structured docs.
- It enables generated markdown/HTML outputs through CLI automation.

## When To Use It
- Use when module or project docs should be generated from source-aware templates.
- Use when linking code, commands, and framework references consistently.
- Use when docs should be reproducible in CI or release workflows.

## When Not To Use It
- Do not hand-edit generated README/DOC outputs directly.
- Do not use this module for generic markdown rendering outside its doc generation model.

## Core Capabilities
- JSX/TSX-based document composition.
- Rich node types for code, terminal, links, and sections.
- CLI generation with watch and multi-output support.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- Document shape/types for authored content exports.
- Node libraries for common documentation patterns.

## Core APIs and Extension Points
- `trv doc` CLI.
- `text` export contract in `DOC.tsx`-style files.
- JSX node components under doc support libraries.

Decision guideline:
Use @travetto/doc when documentation should be generated, reference-checked, and maintained as executable source-adjacent content.

## Typical Integration Flow
1. Author `DOC.tsx` with standard header/sections.
2. Add code/command/reference nodes for examples.
3. Run `trv doc` with desired outputs.
4. Commit generated docs with source changes.

## Practical Scenario
For a new module, define `DOC.tsx`, embed tested command output snippets, and regenerate README + HTML docs in CI to avoid stale guidance.

Common pitfalls:
- Editing generated markdown directly and losing changes on next generation.
- Omitting source links and reducing maintainability.
- Running docs generation without ensuring example code still compiles/runs.
