# Auth Session Maintainer Tips
- Treat session schema changes like data migrations.
- Keep destroy/logout behavior explicit and observable.
- Validate expiry cleanup against realistic load.
- Test persistence behavior when request handlers throw errors.
