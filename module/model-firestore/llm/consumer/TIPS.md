# Model Firestore Tips
- Firestore support here is CRUD + indexed focused, not full query-contract parity.
- Keep collection namespace strategy clear early to avoid migration pain.
- Validate missing/null handling in indexed fields before relying on lookups.
- Separate environment configs cleanly between emulator and production.