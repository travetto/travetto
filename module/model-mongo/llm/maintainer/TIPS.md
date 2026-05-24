# Model Mongo Maintainer Tips
- Be conservative with conversion logic around ids and binary types.
- Any index-creation behavior change should be verified against existing collections.
- Keep cleanup and expiry behavior explicit; timing shifts can cause hidden regressions.
- Ensure support/service descriptor updates stay aligned with default runtime expectations.