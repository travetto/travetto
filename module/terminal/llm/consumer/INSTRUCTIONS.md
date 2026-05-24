# Terminal Instructions
How to build robust command-line output across terminal environments.

## Setup
1. Detect terminal capabilities through Terminal/TerminalUtil.
2. Define style templates using StyleUtil.
3. Use TerminalWriter for progress-oriented output where appropriate.

## Usage Workflow
- Keep output rendering capability-aware and non-assumptive.
- Use template-based styles instead of ad hoc ANSI strings.
- Fall back to non-interactive line output when TTY support is unavailable.

Minimal pattern:
1. Resolve capability mode (interactive vs non-interactive).
2. Format output through style templates.
3. Route progress/status through TerminalWriter with graceful fallback.

## Safe Defaults
- Default to readable plain output in unknown capability environments.
- Keep color and formatting optional, not required for comprehension.
- Keep progress rendering idempotent and interruption-safe.
