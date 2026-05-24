# Terminal Maintainer Overview
Maintainer guidance for terminal capability detection, style rendering, and writer stability.

## Ownership
- Terminal capability/TTY detection.
- Style and palette/template rendering behavior.
- Interactive writer lifecycle and fallback output behavior.

## High-Signal Entry Points
- src/terminal.ts
- src/style.ts
- src/writer.ts
- src/util.ts

## Integration Boundaries
- Consumed by CLI and tooling modules requiring stable output formatting.
- Must remain transport-neutral and safe across local shells, CI, and redirected streams.

## Compatibility Boundaries
- Capability-detection semantics and style rendering output are externally visible contracts.
- Writer behavior for progress/update/fallback modes is semver-sensitive for CLI UX.

## Testing Expectations
- Validate color-capability detection across simulated terminal environments.
- Validate style template rendering and fallback plain-text behavior.
- Recheck writer behavior for interactive updates and non-interactive logging.

## Change-Triage Guidance
- Detection changes: test TTY/non-TTY and color-level behavior.
- Style changes: verify output readability and token stability.
- Writer changes: validate update frequency, line clearing, and fallback transitions.
