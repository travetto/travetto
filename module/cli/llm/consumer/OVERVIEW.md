# CLI Overview
The @travetto/cli module is the command-line execution surface for Travetto applications and tooling.

## Primary Capabilities
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

## Agent Tooling Surface
- Use npx trv cli:schema to enumerate commands, modules, flags, and input schemas.

## When to use it
Use this module whenever you are exposing operational workflows (build, test, migrate, scaffold, maintenance) through first-class CLI commands.
