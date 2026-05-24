# Doc Instructions
How to generate and maintain module docs with @travetto/doc.

## Setup
1. Install @travetto/doc.
2. Create or update `DOC.tsx` in your module/project.
3. Export a valid `text` document body.

## Usage Workflow
- Compose docs using doc JSX nodes.
- Use `trv doc` to generate markdown/html outputs.
- Re-run generation whenever source references/examples change.

Minimal pattern:
1. Edit `DOC.tsx`.
2. Run `trv doc -o README.md` (or html).
3. Validate generated output in review/CI.

## Safe Defaults
- Treat generated docs as build artifacts.
- Keep command/code snippets current and executable.
- Keep references stable and explicit.
