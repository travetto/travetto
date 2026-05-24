# Terminal Maintainer Instructions

## Change Strategy
- Preserve capability-aware behavior across terminal modes.
- Keep rendering deterministic and readable without requiring color support.
- Prefer additive style/template extensions over behavioral rewrites.

## Implementation Notes
- Keep TTY detection and color-level logic explicit and test-backed.
- Ensure TerminalWriter remains safe under rapid updates and interruptions.
- Avoid introducing output side effects that leak across commands.

## Validation
- Run module tests for style rendering and writer behavior.
- Validate representative CLI usage in interactive and non-interactive modes.
- Recheck regressions in CI-style output where TTY features are unavailable.

## Regression Checklist
- Capability detection remains stable across environments.
- Interactive writer degrades cleanly to non-interactive output.
- Style output remains backward compatible for existing command logs.
