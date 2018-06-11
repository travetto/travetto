travetto: Log
===

This module provides basic stdout logging via AST transformations. The code is rewritten at compile time to transform
`console.(log|info|trace|warn|error)` into proper logging commands.  In addition to the transformation, class name and line number are added to the log messages to provide additional context.

Note: In production, all `console.(debug|trace)` messages are compiled away for performance/security reasons.