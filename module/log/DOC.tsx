/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

const Logger = d.codeLink('Logger', 'src/types.ts', /interface Logger/);
const LogEvent = d.codeLink('LogEvent', 'src/types.ts', /interface LogEvent/);
const ConsolEvent = d.codeLink('ConsoleEvent', '@travetto/base/src/types.ts', /type ConsoleEvent/);

const ConsoleManager = d.ref('ConsoleManager', '@travetto/base/src/console.ts');

export const text = <>
  <c.StdHeader />
  This module provides logging functionality, building upon {ConsoleManager} in the {d.mod('Base')} module.  This is all ultimately built upon {d.library('Console')} operations. The logging infrastructure is built upon the {d.mod('Di')} system, and so new loggers can be created that rely upon dependency injected services and sources.

  <c.Section title='Creating a Logger'>
    The default pattern for logging is to create a {Logger} which simply consumes a logging event. The method is not asynchronous as ensuring the ordering of append calls will be the responsibility of the logger.  The default logger uses {d.method('console.log')} and that is synchronous by default.

    <c.Code title='Logger Shape' src='src/types.ts' startRe={/interface Logger/} endRe={/^[}]/} />

    <c.Code title='Log Event' src='src/types.ts' startRe={/interface LogEvent/} endRe={/^[}]/} />

    <c.Code title='Console Event' src='@travetto/base/src/types.ts' startRe={/type ConsoleEvent/} endRe={/^[}]/} />

    The {LogEvent} is an extension of the {ConsolEvent} with the addition of two fields:

    <ul>
      <li>{d.field('message')} - This is the primary argument passed to the console statement, if it happens to be a string, otherwise the field is left empty</li>
      <li>{d.field('context')} - This is the final argument passed to the console statement, if it happens to be a simple object.  This is useful for external loggers that allow for searching/querying by complex data</li>
    </ul>

    <c.Code title='Custom Logger' src='doc/custom-logger.ts' />
  </c.Section>

  <c.Section title='Logging to External Systems'>
    By default the logging functionality logs messages directly to the console, relying on the {d.method('util.inspect')} method, as is the standard behavior.  When building distributed systems, with multiple separate logs, it is useful to rely on structured logging for common consumption.  The framework supports logging as {d.library('JSON')}, which is easily consumable by services like {d.library('Elasticsearch')} or {d.library('AwsCloudwatch')} if running as a lambda or in a docker container. <br />

    The main caveat that comes with this, is that not all objects can be converted to JSON (specifically circular dependencies, and unsupported types).  That end, the framework recommends logging with the following format, {d.input('message: string')}&nbsp;&nbsp;&nbsp;{d.input('context: Record<string, Primitive>')}.  Here context can be recursive, but the general idea is to only pass in known data structures that will not break the {d.library('JSON')} production.
  </c.Section>

  <c.Section title='Environment Configuration'>

    <c.Code title='Standard Logging Config' src='src/common.ts' startRe={/class CommonLoggerConfig/} endRe={/^[}]/} />

    The following environment variables have control over the default logging config:
    <ul>
      <li>{d.input('TRV_LOG_FORMAT')} - This determines whether or not the output is standard text lines, or is it output as a single line of {d.library('JSON')}</li>
      <li>{d.input('TRV_LOG_FILE')} - This determines whether or not the logging goes to the console or if it is written to a file</li>
      <li>{d.input('TRV_LOG_PLAIN')} - Allows for an override of whether or not to log colored output, this defaults to values provided by the {d.mod('Terminal')} in response to {d.input('FORCE_COLOR')} and {d.input('NO_COLOR')}</li>
      <li>{d.input('TRV_LOG_TIME')} - This represents what level of time logging is desired, the default is {d.input('ms')} which is millisecond output.  A value of {d.input('s')} allows for second level logging, and {d.input('false')} will disable the output. When ingesting the content into another logging, its generally desirable to suppress the initial time output as most other loggers will append as needed.</li>
    </ul>
  </c.Section>
</>;