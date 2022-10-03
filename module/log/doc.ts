import { d, lib, mod } from '@travetto/doc';
import { TranspileCache } from '@travetto/boot/src/internal/transpile-cache';

const ConsoleManager = d.Ref('ConsoleManager', '@travetto/base/src/console.ts');

export const text = d`
${d.Header()}

This module provides logging functionality, building upon ${ConsoleManager} in the ${mod.Base} module.  This is all ultimately built upon ${lib.Console} operations. 

The supported operations are:
${d.List(
  d`${d.Method('console.error')} which logs at the ${d.Input('ERROR')} level`,
  d`${d.Method('console.warn')} which logs at the ${d.Input('WARN')} level`,
  d`${d.Method('console.info')} which logs at the ${d.Input('INFO')} level`,
  d`${d.Method('console.debug')} which logs at the ${d.Input('DEBUG')} level`,
  d`${d.Method('console.log')} which logs at the ${d.Input('INFO')} level`,
)}

${d.Note(d`All other console methods are excluded, specifically ${d.Method('trace')}, ${d.Method('inspect')}, ${d.Method('dir')}, ${d.Method('time')}/${d.Method('timeEnd')}`)}

${d.Section('Filtering Debug')}

The ${d.Input('debug')} messages can be filtered using the patterns from the ${lib.Debug}.  You can specify wild cards to only ${d.Input('DEBUG')} specific modules, folders or files.  You can specify multiple, and you can also add negations to exclude specific packages.

${d.Terminal('Sample environment flags', `
# Debug
$ DEBUG=@app:*,-@trv:model npx trv run app
$ DEBUG=-@trv:registry npx trv run app
$ DEBUG=@trv:rest npx trv run app
$ DEBUG=@trv:*,-@trv:model npx trv run app
`)}

${d.Note(d`In production mode, all ${d.Method('console.debug')} invocations are compiled away for performance/security reasons. This means that the code is actually removed, and will not execute.`)}

${d.Section('How Logging is Instrumented')}

All of the logging instrumentation occurs at transpilation time.  All ${d.Method('console.*')} methods are replaced with a call to a globally defined variable that delegates to the ${ConsoleManager}.  This module, hooks into the ${ConsoleManager} and receives all logging events from all files compiled by the ${mod.Compiler} module.

A sample of the instrumentation would be:

${d.Code('Sample logging at various levels', 'doc/transpile.ts')}

${d.Code('Sample After Transpilation', TranspileCache.readEntry('doc/transpile.ts'), false, 'javascript')}

And when in ${d.Input('prod')} mode transforms into:

${d.Code('Sample After Transpilation, in Prod', TranspileCache.readEntry('doc/transpile-prod.ts'), false, 'javascript')}

${d.Section('Logging to External Systems')}
By default the logging functionality logs messages directly to the console, relying on the ${d.Method('util.inspect')} method, as is the standard behavior.  When building distributed systems, with multiple separate logs, it is useful to rely on structured logging for common consumption.  The framework supports logging as ${lib.JSON}, which is easily consumable by services like ${lib.Elasticsearch} or ${lib.AwsCloudwatch} if running as a lambda or in a docker container.  

The main caveat that comes with this, is that not all objects can be converted to JSON (specifically circular dependencies, and unsupported types).  That end, the framework recommends logging with the following format, ${d.Input('message: string')} ${d.Input('context: Record<string, Primitive>')}.  Here context can be recursive, but the general idea is to only pass in known data structures that will not break the ${lib.JSON} production.

${d.Section('Sample Output')}

The logging output, as indicated provides context for location of invocation. Given the file ${d.Path('test/simple.ts')}:

${d.Code('Various log levels', 'doc/output.ts')}

The corresponding output would be

${d.Execute('Logging output', 'doc/output.ts', [], {
  env: {
    TRV_DEBUG: '@trv:log',
    TRV_LOG_PLAIN: '0'
  },
  filter: l => l.startsWith(`${new Date().getFullYear()}`)
})}
`;