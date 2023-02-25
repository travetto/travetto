import { d, lib, mod } from '@travetto/doc';

const Appender = d.SnippetLink('LoggingAppender', 'src/types.ts', /interface Appender/);
const Logger = d.SnippetLink('Logger', 'src/types.ts', /interface Logger/);
const LogEvent = d.SnippetLink('LogEvent', 'src/types.ts', /interface LogEvent/);
const ConsolEvent = d.SnippetLink('ConsoleEvent', '@travetto/base/src/types.ts', /type ConsoleEvent/);

const ConsoleManager = d.Ref('ConsoleManager', '@travetto/base/src/console.ts');

export const text = () => d`
${d.Header()}

This module provides logging functionality, building upon ${ConsoleManager} in the ${mod.Base} module.  This is all ultimately built upon ${lib.Console} operations. The logging infrastructure is built upon the ${mod.Di} system, and so new loggers can be created that rely upon dependency injected services and sources.

${d.Section('Creating a Logger')}
The default pattern for logging is to create a ${Logger} which simply consumes a logging event. The method is not asynchronous as ensuring the ordering of append calls will be the responsibility of the logger.  The default logger uses ${d.Method('console.log')} and that is synchronous by default.

${d.Snippet('Logger Shape', 'src/types.ts', /interface Logger/, /^[}]/)}

${d.Snippet('Log Event', 'src/types.ts', /interface LogEvent/, /^[}]/)}

${d.Snippet('Console Event', '@travetto/base/src/types.ts', /type ConsoleEvent/, /^[}]/)}

The ${LogEvent} is an extension of the ${ConsolEvent} with the addition of two fields:

${d.List(
  d`${d.Field('message')} - This is the primary argument passed to the console statement, if it happens to be a string, otherwise the field is left empty`,
  d`${d.Field('context')} - This is the final argument passed to the console statement, if it happens to be a simple object.  This is useful for external loggers that allow for searching/querying by complex data`
)}

${d.Code('Custom Logger', 'doc/custom-logger.ts')}


${d.Section('Logging to External Systems')}
By default the logging functionality logs messages directly to the console, relying on the ${d.Method('util.inspect')} method, as is the standard behavior.  When building distributed systems, with multiple separate logs, it is useful to rely on structured logging for common consumption.  The framework supports logging as ${lib.JSON}, which is easily consumable by services like ${lib.Elasticsearch} or ${lib.AwsCloudwatch} if running as a lambda or in a docker container.  

The main caveat that comes with this, is that not all objects can be converted to JSON (specifically circular dependencies, and unsupported types).  That end, the framework recommends logging with the following format, ${d.Input('message: string')}&nbsp;&nbsp;&nbsp;${d.Input('context: Record<string, Primitive>')}.  Here context can be recursive, but the general idea is to only pass in known data structures that will not break the ${lib.JSON} production.

${d.Section('Environment Configuration')}

${d.Snippet('Standard Logging Config', 'src/common.ts', /class CommonLoggerConfig/, /^[}]/)}

The following environment variables have control over the default logging config:
${d.List(
  d`${d.Input('TRV_LOG_FORMAT')} - This determines whether or not the output is standard text lines, or is it output as a single line of ${lib.JSON}`,
  d`${d.Input('TRV_LOG_FILE')} - This determines whether or not the logging goes to the console or if it is written to a file`,
  d`${d.Input('TRV_LOG_PLAIN')} - Allows for an override of whether or not to log colored output, this defaults to values provided by the ${mod.Terminal} in response to ${d.Input('FORCE_COLOR')} and ${d.Input('NO_COLOR')}`,
  d`${d.Input('TRV_LOG_TIME')} - This represents what level of time logging is desired, the default is ${d.Input('ms')} which is millisecond output.  A value of ${d.Input('s')} allows for second level logging, and ${d.Input('false')} will disable the output. When ingesting the content into another logging, its generally desirable to suppress the initial time output as most other loggers will append as needed.`,
)}
`;