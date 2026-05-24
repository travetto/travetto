# Eslint Instructions
How to use framework ESLint support reliably.

## Setup
1. Install @travetto/eslint.
2. Run `trv eslint:register` to create `eslint.config.js`.
3. Verify config references align with your module mode and workspace output paths.

## Usage Workflow
- Run `trv eslint` locally before commit.
- Run same command in CI for consistent rule enforcement.
- Add custom rules through `TrvEslintPlugin` under support paths when needed.

Minimal pattern:
1. Register config.
2. Lint codebase with CLI.
3. Add and validate custom rules incrementally.

## Safe Defaults
- Keep generated config as source of truth for tooling integration.
- Keep custom rules narrowly scoped and test-backed.
- Keep rule severity defaults explicit in plugin definitions.
