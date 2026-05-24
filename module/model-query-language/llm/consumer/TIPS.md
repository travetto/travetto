# Model Query Language Tips
- Keep this language for filtering concerns; keep business authorization separate.
- Use direct query objects for trusted internal code paths and parsed text for user-authored filters.
- Regex clauses are powerful, so enforce endpoint-level safeguards for expensive patterns.
- Preserve original user query text in logs when troubleshooting parser issues.