# Model Firestore Maintainer Tips
- Firestore query limitations should be reflected in tests and docs, not hidden in code paths.
- Keep namespace and id handling behavior stable.
- Be conservative when changing missing-value treatment in indexed flows.
- Validate both emulator and production-like config flows.