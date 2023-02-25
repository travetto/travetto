import { d, mod, lib } from '@travetto/doc';

import { LockManager } from './support/lock';

const TrvEntry = d.SnippetLink('trv', 'bin/trv.js', /[(]async/);

export const text = () => d`
${d.Header()}
This module expands upon the ${lib.Typescript} compiler, with the additional features:
${d.List(
  d`Integration with the ${mod.Transformer} module, allowing for rich, type-aware transformations`,
  d`Automatic conversion to either ${lib.EcmascriptModule} or ${lib.CommonJS} based on the ${lib.PackageJson} ${d.Field('type')} value`,
  d`Removal of type only imports which can break ${lib.EcmascriptModule}-style output`,
  d`Automatic addition of ${d.Path('.js')} extension to imports to also support  ${lib.EcmascriptModule}-style output`,
)}

Beyond the ${lib.Typescript} compiler functionality, the module provides the primary entry point into the development process.  

${d.Section('CLI')}

The cli, ${TrvEntry} is a compilation aware entry point, that has the ability to check for active builds, and ongoing watch operations to ensure only one process is building at a time.  Within the framework, regardless of mono-repo or not, always builds the entire project.  With the efficient caching behavior, this leads to generally a minimal overhead but allows for centralization of all operations.

The CLI supports the following operations:

${d.List(
  d`${d.Method('clean')} - Removes the output folder, and if ${d.Input('-a')} is also passed, will also clean out the compiler folder`,
  d`${d.Method('build')} - Will attempt to build the project.  If the project is already built, will return immediately.  If the project is being built somewhere else, will wait until a build is completed.`,
  d`${d.Method('watch')} - If nothing else is watching, will start the watch operation.  Otherwise will return immediately.`,
  d`${d.Method('manifest')} - Will produce a manifest. If no file is passed in the command line arguments, will output to stdout`,
  d`${d.Method('<other>')} - Will be delegated to the ${mod.Cli} entry point after a successful build.`
)}

In addition to the normal output, the compiler supports an environment variable ${d.Input('TRV_BUILD')} that supports the following values: ${d.Input('debug')}, ${d.Input('info')}, ${d.Input('warn')} or ${d.Input('none')}.  This provides different level of logging during the build process which is helpful to diagnose any odd behaviors.  When invoking an unknown command (e.g. ${d.Method('<other>')} from above), the default level is ${d.Input('warn')}.  Otherwise the default logging level is ${d.Input('info')}.


${d.Execute('Sample trv output with debug logging', 'trv', ['build'], {
  env: { TRV_BUILD: 'debug' },
  rewrite: val => val.replace(/pid=\d+/g, 'pid=000000'),
  formatCommand: (cmd, args) => `TRV_BUILD=debug ${cmd} ${args.join(' ')}`
})}

${d.Execute('Sample trv output with default log level', 'trv', ['build'])}


${d.Section('Compilation Architecture')}

The compiler will move through the following phases on a given compilation execution:
${d.List(
  d`${d.Method('Bootstrapping')} - Initial compilation of ${mod.Compiler}'s ${d.Path('support/*.ts')} files`,
  d`${d.Method('Lock Management')} - Manages cross-process interaction to ensure single compiler`,
  d`${d.Method('Build Compiler')} - Leverages ${lib.Typescript} to build files needed to execute compiler`,
  d`${d.Method('Build Manifest')} - Produces the manifest for the given execution`,
  d`${d.Method('Build Transformers')} - Leverages ${lib.Typescript} to compile all transformers defined in the manifest`,
  d`${d.Method('Produce Manifest Delta')} - Compare the output file system with the manifest to determine what needs to be compiled`,
  d`${d.Method('Clear all output if needed')} - When the compiler source or transformers change, invalidate the entire output`,
  d`${d.Method('Persist Manifest(s)')} - Ensure the manifest is available for the compiler to leverage. Multiple will be written if in a monorepo`,
  d`${d.Method('Invoke Compiler')} - Run ${lib.Typescript} compiler with the aforementioned enhancements`
)}

${d.SubSection('Bootstrapping')}

Given that the framework is distributed as ${lib.Typescript} only files, there is a bootstrapping problem that needs to be mitigated.  The ${TrvEntry} entrypoint, along with a small context utility in ${mod.Manifest} are the only ${lib.Javascript} files needed to run the project.  The ${TrvEntry} entry point will compile ${d.Path('@travetto/compiler/support/*')} files as the set that is used at startup.  These files are also accessible to the compiler as they get re-compiled after the fact.  

${d.SubSection('Lock Management')}

The compiler supports invocation from multiple locations at the same time, and provides a layer of orchestration to ensure a single process is building at a time.  For a given project, there are four main states:

${d.List(
  'No Watch - Building',
  'Watch    - No Build',
  'Watch    - Building',
  'Inactive / Stale'
)}

Depending on what state the project is in (depending on various processes), will influence what the supporting tooling should do. ${LockManager} represents the majority of the logic for tracking various states, and informing what action should happen when in the above states.  
`;