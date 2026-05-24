# Auth Web Maintainer Instructions

## Change Strategy
- Preserve decorator and interceptor semantics for existing endpoints.
- Keep codec contracts explicit and backward compatible.
- Prefer additive transport/config options over behavior rewrites.

## Implementation Notes
- Keep auth context bridging deterministic per request.
- Keep token transport encode/decode logic centralized.
- Ensure auth errors remain typed and actionable.

## Validation
- Run module tests for endpoint decorator and codec behavior.
- Validate both configured transport modes where relevant.
- Recheck one downstream integration (session or passport).

## Regression Checklist
- Route access control semantics remain stable.
- Principal decode/encode behavior remains compatible.
- Request-scoped auth context remains isolated.
