# Auth Web Session Tips
- Use interceptor lifecycle; avoid manual load/persist in handlers.
- Keep session mutation paths explicit and testable.
- Verify session context availability on protected routes.
- Keep session destroy/logout behavior consistent with auth policies.
