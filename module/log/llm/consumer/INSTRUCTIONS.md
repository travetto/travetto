# Logging Instructions
How to configure and use framework-native logging effectively.

## Setup
1. Install and enable @travetto/log.
2. Configure CommonLoggerConfig format/output defaults.
3. Add custom formatter/appender bindings through DI when needed.

## Usage Workflow
- Use consistent console/logger calls from application code.
- Select line format for local readability and JSON format for log aggregation.
- Configure output targets (console/file/custom appender) per environment.

Minimal pattern:
1. Start with default line+console config.
2. Switch production to JSON and ingestion-friendly metadata.
3. Extend via DI for organization-specific sinks or formatting.

## Safe Defaults
- Keep log event payloads serializable and structured.
- Keep environment-specific logging behavior explicit in config.
- Prefer additive metadata over format-breaking message rewrites.
