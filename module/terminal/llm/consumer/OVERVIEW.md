# Terminal Overview
The @travetto/terminal module provides terminal capability detection, styling helpers, and interactive output primitives used by framework tooling.

## What This Module Is
This module is the framework terminal abstraction layer for colorized output, TTY-aware rendering, and interactive writer behavior.

## Why To Use It
- It normalizes terminal color capability handling across environments.
- It supports palette/template-driven output styling.
- It provides interactive progress/writer primitives with quiet-mode fallbacks.

## When To Use It
- Use when building CLI output that should adapt to terminal capabilities.
- Use when you need consistent style templates for command output.
- Use when interactive progress indicators should degrade gracefully in non-TTY contexts.

## When Not To Use It
- Do not hardcode ANSI sequences directly when style utilities provide safer output.
- Do not assume full-color or TTY support in CI and redirected output modes.

## Primary Capabilities
- Terminal color level/background detection.
- Palette and template-based style rendering.
- Interactive writer support with non-interactive fallback behavior.

## Decorators
- This module does not expose consumer decorators.

## Utility Classes (Non-Internal)
- StyleUtil: palette/template creation and style lookup helpers.
- TerminalUtil: terminal capability checks and output-mode helpers.

## Core APIs and Extension Points
- Terminal: environment-aware terminal metadata and capability access.
- TerminalWriter: dynamic line/progress streaming for command UX.

## Typical Integration Flow
1. Detect terminal capabilities using Terminal/TerminalUtil.
2. Build a style template with StyleUtil.
3. Render command output through styled templates.
4. Use TerminalWriter for progress-oriented interactive output.

## Practical Scenario
For a long-running CLI task, show spinner/progress in TTY mode and emit concise line-by-line status in CI mode while preserving readable color semantics where supported.

## When to use it
Use this module when command-line UX must be robust across local terminals, CI logs, and different color-capability environments.
