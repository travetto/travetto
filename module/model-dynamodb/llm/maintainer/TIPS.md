# Model Dynamodb Maintainer Tips
- Treat index evolution as an operational migration concern, not just a code change.
- Keep utility conversions and index-name derivation stable.
- Be conservative when changing condition expressions and update statements.
- Validate contract parity across CRUD and indexed flows after refactors.