# Web Maintainer Instructions

## Change Strategy
- Preserve route metadata contracts and endpoint registration rules.
- Keep transport-neutral logic in core web module.

## Implementation Notes
- Update decorators and endpoint extraction logic consistently.
- Keep interceptor ordering/resolution deterministic.
- Treat WebBodyUtil and WebHeaderUtil changes as compatibility-sensitive.

## Validation
- Validate parameter extraction across body/path/query/header variants.
- Verify interceptor inclusion/exclusion and conditional registration behavior.

## Regression Checklist
- Route and parameter metadata remains backward compatible.
- Interceptor ordering and filtering remains deterministic.
- Body/header utility behavior remains stable for existing transports.
