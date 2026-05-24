# Model S3 Tips
- Separate document keys and blob keys consistently.
- Test local endpoint settings (for example LocalStack) separately from production settings.
- Use signed URLs for client-facing access rather than exposing raw object keys.
- Keep chunk-size tuning explicit for large-upload workloads.