# CLI Overview
The @travetto/cli module is the command-line execution surface for Travetto applications and tooling.

## What This Module Is
This module is the framework command system for declaring, validating, and executing typed CLI commands.

## Why To Use It
- It turns operational workflows into first-class, discoverable commands.
- It keeps command flags/arguments typed and schema-validated.
- It integrates with tooling through command schema introspection.

## When To Use It
- Use when exposing build/test/scaffold/maintenance operations via CLI.
- Use when command input validation and structured help output are required.
- Use when editor or automation tooling must introspect command schemas.

## When Not To Use It
- Do not build ad hoc scripts for workflows that should be stable public commands.
- Do not duplicate input parsing logic outside the command class contract.

## Core Capabilities
- Declarative command definitions with decorators.
- Strongly typed flag/input handling integrated with schema validation.
- Module-aware command execution in monorepos.
- Tooling integration with command schema discovery.

## Decorators
- @CliCommand: define a class as a CLI command target.
- @CliFlag: define a typed command flag.
- @CliFileFlag: define a file-path flag with file semantics.
- @CliProfilesFlag: add profile-selection support.
- @CliModuleFlag: add module-targeting support.
- @CliRestartOnChangeFlag: enable restart-on-change workflows.
- @CliDebugIpcFlag: expose debug IPC diagnostics.

## Utility Classes (Non-Internal)
- CliUtil: helpers for command option parsing, restart-on-change execution, IPC debug output, and stream-safe writes.

Agent tooling surface:
- Use npx trv cli:schema to enumerate commands, modules, flags, and input schemas.

## Core APIs and Extension Points
- Command decorators and class contracts.
- CliUtil for command option handling and restart-on-change behavior.

Decision guideline:
Use typed command classes and CLI decorators for operational workflows that need discoverability, validation, and tooling introspection, instead of ad hoc scripts.

## Typical Integration Flow
1. Create a command class under support/cli.*.ts.
2. Decorate with @CliCommand and define typed flags/arguments.
3. Run via trv command name and validate behavior with --help.
4. Expose command metadata via npx trv cli:schema for tool consumers.

## Practical Scenario
When a release pipeline needs one consistent entrypoint, wrap versioning, validation, and packaging in a typed command so humans and automation invoke identical logic.

Common pitfalls:
- Adding ambiguous flags without explicit defaults and schema validation intent.
- Duplicating command parsing logic outside decorator-driven contracts.
- Changing flag names or behavior without updating cli:schema consumers.

