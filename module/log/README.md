travetto: Log
===

This module provides logging utilities using log4js.  Should support standard appenders, but 
will wrap everything in a filter to control the log levels available.

We have two custom layouts that are provided:
  - `json`: standard json layouts
  - `standard`: console layouts

The code also fills missing functionality for binding console.* to the appropriate log level
  - DEBUG - `console.debug`
  - INFO - `console.info`, `console.log`
  - WARN - `console.warn`
  - ERROR - `console.error`