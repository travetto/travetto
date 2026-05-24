# CLI Maintainer Instructions

## Change Strategy
- Preserve command/flag metadata compatibility for existing commands.
- Keep cli:schema output stable unless intentional breaking change.

## Implementation Notes
- Update decorators and registry logic together.
- Keep CliUtil behavior deterministic for option parsing and restart flows.
- Validate module/profile flag behavior in monorepo contexts.

## Validation
- Validate command discovery and schema generation.
- Verify restart-on-change and debug IPC paths when touched.
