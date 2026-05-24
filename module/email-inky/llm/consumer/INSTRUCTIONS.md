# Email Inky Instructions
How to author inky-based email templates effectively.

## Setup
1. Install @travetto/email-inky and @travetto/email-compiler.
2. Enable JSX import source for inky support components.
3. Define style/wrapper overrides if branding requires customization.

## Usage Workflow
- Build templates using Inky components and layout primitives.
- Use `If`, `Unless`, `For`, and `Value` helpers for mustache-compatible logic.
- Compile templates to artifacts before runtime sending.

Minimal pattern:
1. Author JSX template with inky components.
2. Add substitution/control-flow helpers for dynamic content.
3. Run compile and verify rendered output.

## Safe Defaults
- Keep templates componentized and avoid duplicated layout fragments.
- Keep substitutions explicit and test with representative data.
- Keep wrapper/style overrides centralized and versioned.
