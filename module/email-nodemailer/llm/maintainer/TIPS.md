# Email Nodemailer Maintainer Tips
- Test with real provider-like settings, not only mocked transports.
- Keep adapter behavior thin and framework-contract-focused.
- Treat option schema changes as rollout-sensitive.
- Validate failure modes for auth, DNS, and connectivity errors.
