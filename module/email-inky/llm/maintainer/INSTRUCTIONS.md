# Email Inky Maintainer Instructions

## Change Strategy
- Preserve component contract behavior for existing templates.
- Keep emitted template structure deterministic.
- Prefer additive component capabilities over semantic rewrites.

## Implementation Notes
- Keep JSX helper behavior explicit and test-backed.
- Avoid introducing ambiguous mapping between JSX and mustache output.
- Ensure extension points continue to integrate with compiler pipeline.

## Validation
- Run module tests for component rendering and helper semantics.
- Validate representative templates through full compile pipeline.
- Recheck compatibility with wrapper/style overrides.

## Regression Checklist
- Component APIs remain compatible.
- Rendered output remains stable.
- Compiler integration remains predictable.
