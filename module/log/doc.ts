import { doc as d, lib, inp, Terminal, List, Note, Section, mod, Ref, meth, Code, Execute, pth, Header } from '@travetto/doc';
import { AppCache } from '@travetto/boot';

const ConsoleManager = Ref('ConsoleManager', '@travetto/base/src/console.ts');

export const text = d`
${Header()}

This module provides logging functionality, building upon ${ConsoleManager} in the ${mod.Base} module.  This is all ultimately built upon ${lib.Console} operations. 

The supported operations are:
${List(
  d`${meth`console.error`} which logs at the ${inp`ERROR`} level`,
  d`${meth`console.warn`} which logs at the ${inp`WARN`} level`,
  d`${meth`console.info`} which logs at the ${inp`INFO`} level`,
  d`${meth`console.debug`} which logs at the ${inp`DEBUG`} level`,
  d`${meth`console.log`} which logs at the ${inp`INFO`} level`,
)}

${Note(d`All other console methods are excluded, specifically ${meth`trace`}, ${meth`inspect`}, ${meth`dir`}, ${meth`time`}/${meth`timeEnd`}`)}

${Section('Filtering Debug')}

The ${inp`debug`} messages can be filtered using the patterns from the ${lib.Debug}.  You can specify wild cards to only ${inp`DEBUG`} specific modules, folders or files.  You can specify multiple, and you can also add negations to exclude specific packages.

${Terminal('Sample environment flags', `
# Debug
$ DEBUG=@app:*,-@trv:model npx trv run app
$ DEBUG=-@trv:registry npx trv run app
$ DEBUG=@trv:rest npx trv run app
$ DEBUG=@trv:*,-@trv:model npx trv run app
`)}

${Note(d`In production mode, all ${meth`console.debug`} invocations are compiled away for performance/security reasons. This means that the code is actually removed, and will not execute.`)}

${Section('How Logging is Instrumented')}

All of the logging instrumentation occurs at transpilation time.  All ${meth`console.*`} methods are replaced with a call to a globally defined variable that delegates to the ${ConsoleManager}.  This module, hooks into the ${ConsoleManager} and receives all logging events from all files compiled by the ${mod.Compiler} module.

A sample of the instrumentation would be:

${Code('Sample logging at various levels', 'doc/transpile.ts')}

${Code('Sample After Transpilation', AppCache.readEntry('doc/transpile.ts'), false, 'javascript')}

And when in ${inp`prod`} mode transforms into:

${Code('Sample After Transpilation, in Prod', AppCache.readEntry('doc/transpile-prod.ts'), false, 'javascript')}

${Section('Logging to External Systems')}
By default the logging functionality logs messages directly to the console, relying on the ${meth`util.inspect`} method, as is the standard behavior.  When building distributed systems, with multiple separate logs, it is useful to rely on structured logging for common consumption.  The framework supports logging as ${lib.JSON}, which is easily consumable by services like ${lib.Elasticsearch} or ${lib.AwsCloudwatch} if running as a lambda or in a docker container.  

The main caveat that comes with this, is that not all objects can be converted to JSON (specifically circular dependencies, and unsupported types).  That end, the framework recommends logging with the following format, ${inp`message: string`} ${inp`context: Record<string, Primitive>`}.  Here context can be recursive, but the general idea is to only pass in known data structures that will not break the ${lib.JSON} production.

${Section('Sample Output')}

The logging output, as indicated provides context for location of invocation. Given the file ${pth`test/simple.ts`}:

${Code('Various log levels', 'doc/output.ts')}

The corresponding output would be

${Execute('Logging output', 'doc/output.ts', [], {
  env: {
    TRV_DEBUG: '*',
    TRV_LOG_PLAIN = '0'
  }
})}
`;