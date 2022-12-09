import { d, lib, mod } from '@travetto/doc';

const ConsoleManager = d.Ref('ConsoleManager', '@travetto/base/src/console.ts');

export const text = () => d`
${d.Header()}

This module provides logging functionality, building upon ${ConsoleManager} in the ${mod.Base} module.  This is all ultimately built upon ${lib.Console} operations. 

${d.Section('Logging to External Systems')}
By default the logging functionality logs messages directly to the console, relying on the ${d.Method('util.inspect')} method, as is the standard behavior.  When building distributed systems, with multiple separate logs, it is useful to rely on structured logging for common consumption.  The framework supports logging as ${lib.JSON}, which is easily consumable by services like ${lib.Elasticsearch} or ${lib.AwsCloudwatch} if running as a lambda or in a docker container.  

The main caveat that comes with this, is that not all objects can be converted to JSON (specifically circular dependencies, and unsupported types).  That end, the framework recommends logging with the following format, ${d.Input('message: string')} ${d.Input('context: Record<string, Primitive>')}.  Here context can be recursive, but the general idea is to only pass in known data structures that will not break the ${lib.JSON} production.

${d.Section('Sample Output')}

The logging output, as indicated provides context for location of invocation. Given the file ${d.Path('test/simple.ts')}:

${d.Code('Various log levels', 'doc/output.ts')}

The corresponding output would be

${d.Execute('Logging output', 'trv', ['main', 'support/main.output.ts'], {
  cwd: './doc-exec',
  env: {
    DEBUG: '@travetto/log',
    TRV_LOG_PLAIN: '0'
  },
  filter: l => l.startsWith(`${new Date().getFullYear()}`)
})}
`;