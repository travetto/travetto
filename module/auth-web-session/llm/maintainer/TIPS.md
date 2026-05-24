# Auth Web Session Maintainer Tips
- Keep interceptor dependencies explicit and tested.
- Verify session context injection under concurrent requests.
- Test both mutate and read-only request paths.
- Watch for duplicate persistence calls during integration refactors.
