import { d, Library, inp, Terminal, List, Note, Section, Mod, Ref, meth, Code, Execute, pth } from '@travetto/doc';
import { AppCache } from '@travetto/boot';

const Console = Library('console', 'https://nodejs.org/api/console.html');
const Debug = Library(`debug`, 'https://www.npmjs.com/package/debug');

const BaseConsole = Ref('ConsoleManager', '@travetto/base/src/console.ts');

export default d`
This module provides logging functionality, building upon ${BaseConsole} in the ${Mod('base')} module.  This is all ultimately built upon ${Console} operations. 

The supported operations are:
${List(
  d`${meth`console.fatal`} which logs at the ${inp`FATAL`} level`,
  d`${meth`console.error`} which logs at the ${inp`ERROR`} level`,
  d`${meth`console.warn`} which logs at the ${inp`WARN`} level`,
  d`${meth`console.info`} which logs at the ${inp`INFO`} level`,
  d`${meth`console.debug`} which logs at the ${inp`DEBUG`} level`,
  d`${meth`console.log`} which logs at the ${inp`INFO`} level`,
)}

${Note(d`All other console methods are excluded, specifically ${meth`trace`}, ${meth`inspect`}, ${meth`dir`}, ${meth`time`}/${meth`timeEnd`}`)}

${Section('Filtering Debug')}

The ${inp`debug`} messages can be filtered using the patterns from the ${Debug}.  You can specify wild cards to only ${inp`DEBUG`} specific modules, folders or files.  You can specify multiple, and you can also add negations to exclude specific packages.

${Terminal('Sample environment flags', `
# Debug
$ DEBUG=@app:*,-@trv:model npx travetto run app
$ DEBUG=-@trv:registry npx travetto run app
$ DEBUG=@trv:rest npx travetto run app
$ DEBUG=@trv:*,-@trv:model npx travetto run app
`)}

${Note(d`In production mode, all ${inp`console.debug`} invocations are compiled away for performance/security reasons. This means that the code is actually removed, and will not execute.`)}

${Section('How Logging is Instrumented')}

All of the logging instrumentation occurs at transpilation time.  All ${inp`console.*`} methods are replaced with a call to a globally defined variable that delegates to the ${BaseConsole}.  This module, hooks into the ${BaseConsole} and receives all logging events from all files compiled by the ${Mod('compiler')} module.

A sample of the instrumentation would be:

${Code('Sample logging at various levels', 'alt/docs/src/transpile.ts')}

${Code('Sample After Transpilation', AppCache.readEntry('alt/docs/src/transpile.ts'), false, 'javascript')}

And when in ${inp`prod`} mode transforms into:

${Code('Sample After Transpilation, in Prod', AppCache.readEntry('alt/docs/src/transpile-prod.ts'), false, 'javascript')}

${Section('Sample Output')}

The logging output, as indicated provides context for location of invocation. Given the file ${pth`test/simple.ts`}:

${Code('Various log levels', 'alt/docs/src/output.ts')}

The corresponding output would be

${Execute('Logging output', 'alt/docs/src/output.ts')}
`;