# Runtime LLM Tips

Internal LLM support document. Committed in-repo and intended to remain outside published package files.

## Practical Tips

- Treat runtime as a shared kernel; minor behavior changes can break many modules.
- Prefer existing JSON/time/binary utilities over duplicating logic.
- Keep environment parsing strict enough to fail clearly, but not crash unpredictably.

## Common Pitfalls

- Assuming filesystem layout details instead of using context/path helpers.
- Hardcoding role or environment conditions without typed env access.
- Adding module-specific semantics that should live elsewhere.

## Debugging Checks

- Verify Runtime context values first when path or resource resolution fails.
- Confirm env-derived behavior with both default and explicit env settings.
- Check shutdown ordering when services appear to hang on exit.
