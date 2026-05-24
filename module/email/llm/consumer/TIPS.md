# Email Tips
- Keep outbound email logic in one service layer.
- Validate template key artifacts in CI before deploy.
- Use null transport for tests and local development by default.
- Keep recipient and sender overrides explicit per environment.
