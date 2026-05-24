# Model Elasticsearch Maintainer Tips
- Search translation code is easy to regress; pair refactors with focused tests.
- Keep serialization behavior explicit for bigint and id fields.
- Watch for mapping drift when model shape evolves.
- Validate both query and indexed paths for behavior parity.