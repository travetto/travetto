# Logging Overview
The @travetto/log module provides framework-native logging that integrates at the console.log level and is configurable through dependency injection.

## What This Module Is
This module is the logging runtime for Travetto applications. It converts console events into structured log events and routes them through configurable formatters and appenders.

## Why To Use It
- You want consistent logging behavior across local development and production.
- You need to switch between human-readable logs and structured JSON logs without rewriting application code.
- You want to integrate custom logging sinks (file, external service, cloud pipeline) via DI extension points.

## When To Use It
- Use for any service that needs standardized application logs.
- Use when observability requires scoped, structured events with consistent metadata.
- Use when deploying to systems that ingest JSON logs.

## When Not To Use It
- Do not bypass this module with ad hoc per-service logger wrappers unless you have a strict integration need.
- Do not emit non-serializable objects when using JSON formatting.

## Core Capabilities
- Console-level interception and event normalization.
- Configurable formatting (`line` or `json`) and output (`console` or `file`) through CommonLoggerConfig.
- Extension points for custom LogFormatter, LogAppender, and LogDecorator implementations.
- Environment-driven runtime behavior (`TRV_LOG_FORMAT`, `TRV_LOG_OUTPUT`, related flags).

## Decorators
- No consumer decorators.

## Utility Classes (Non-Internal)
- This module does not expose consumer utility classes under non-internal paths.

## Core APIs and Extension Points
- CommonLogger and CommonLoggerConfig.
- LogFormatter implementations: LineLogFormatter, JsonLogFormatter, GoogleLogFormatter.
- LogAppender implementations: ConsoleLogAppender, FileLogAppender.
- LogEvent and Logger contracts for custom integrations.

Decision guideline:
Use module-configured formatter/appender composition as the canonical logging surface, and keep application code on consistent console/logger usage patterns.

## Typical Integration Flow
1. Install @travetto/log and keep default line+console settings for local development.
2. Switch to JSON output in environments that aggregate logs.
3. Add custom formatter/appender/decorator via DI for organization-specific logging requirements.
4. Keep application code using standard console logging patterns while the module handles formatting/routing.

## Practical Scenario
If you run services across multiple environments, start with line logs locally for readability and use JSON logs in production so log platforms can query by fields like module, scope, and level.

Common pitfalls:
- Emitting non-serializable payloads while expecting stable JSON logs.
- Bypassing configured logger pathways with ad hoc wrappers.
- Changing formatter output shape without validating downstream ingestion contracts.
