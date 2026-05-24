# Web Tips
- Avoid mixing transport concerns with domain logic in controller methods.
- Use EndpointUtil/WebBodyUtil semantics when debugging parameter extraction issues.
- Keep interceptor ordering intentional; document exclusions with @ExcludeInterceptors.
- Use cookie helpers (CookieJar/KeyGrip/WebHeaderUtil) instead of raw header string manipulation.
