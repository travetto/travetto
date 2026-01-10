/** @jsxImportSource @travetto/doc/support */
import { d, c, DocRunUtil } from '@travetto/doc';

const TrvcEntry = d.codeLink('trvc', 'bin/trvc.js', /#/);

export const text = async () => {
  await DocRunUtil.run('npx', ['trvc', 'build'], { workingDirectory: './doc-exec' });

  const output =
    (await DocRunUtil.run('npx', ['trvc', 'help']))
      .split('\n')
      .filter(x => x.trim().startsWith('*'))
      .map<[string, string]>(x => {
        const [a, b] = x.split(' - ');
        return [a, b];
      })
      .filter(x => x.length > 1)
      .map(x => <li>{d.method(x[0].replace('*', '').trim())} - {x[1].trim()}</li>);

  return <>
    <c.StdHeader />

    This module expands upon the {d.library('Typescript')} compiler, with the additional features:

    <ul>
      <li>Integration with the {d.mod('Transformer')} module, allowing for rich, type-aware transformations</li>
      <li>Automatic conversion to either {d.library('EcmascriptModule')} or {d.library('CommonJS')} based on the {d.library('PackageJson')} {d.field('type')} value</li>
      <li>Removal of type only imports which can break {d.library('EcmascriptModule')}-style output</li>
      <li>Automatic addition of {d.path('.js')} extension to imports to also support  {d.library('EcmascriptModule')}-style output</li>
    </ul>

    Beyond the {d.library('Typescript')} compiler functionality, the module provides the primary entry point into the development process.

    <c.Section title='CLI'>

      The compiler cli, {TrvcEntry} is the entry point for compilation-related operations. It has the ability to check for active builds, and ongoing watch operations to ensure only one process is building at a time.  Within the framework, regardless of mono-repo or not, the compilation always targets the entire project.  With the efficient caching behavior, this leads to generally a minimal overhead but allows for centralization of all operations. <br />

      The compiler cli supports the following operations:

      <ul>
        {output}
      </ul>

      In addition to the normal output, the compiler supports an environment variable {d.input('TRV_BUILD')} that supports the following values: {d.input('debug')}, {d.input('info')}, {d.input('warn')} or {d.input('none')}.  This provides different level of logging during the build process which is helpful to diagnose any odd behaviors.  When invoking an unknown command (e.g. {d.method('<other>')} from above), the default level is {d.input('warn')}.  Otherwise the default logging level is {d.input('info')}.

      <c.Execution title='Sample trv output with debug logging' cmd='trvc' args={['build']} config={{
        env: { TRV_BUILD: 'debug' },
        workingDirectory: './doc-exec',
        rewrite: value => value.replace(/pid=\d+/g, 'pid=000000'),
        formatCommand: (cmd, args) => `TRV_BUILD=debug ${cmd} ${args.join(' ')}`
      }} />

      <c.Execution title='Sample trv output with default log level' cmd='trvc' args={['build']} />
    </c.Section>

    <c.Section title='Compilation Architecture'>

      The compiler will move through the following phases on a given compilation execution:
      <ul>
        <li>{d.method('Compiler Server')} - Provides a simple HTTP interface to watching compiler file and state changes, and synchronizing multiple processes</li>
        <li>{d.method('Build Compiler')} - Leverages {d.library('Typescript')} to build files needed to execute compiler</li>
        <li>{d.method('Build Manifest')} - Produces the manifest for the given execution</li>
        <li>{d.method('Build Transformers')} - Leverages {d.library('Typescript')} to compile all transformers defined in the manifest</li>
        <li>{d.method('Produce Manifest Delta')} - Compare the output file system with the manifest to determine what needs to be compiled</li>
        <li>{d.method('Clear all output if needed')} - When the compiler source or transformers change, invalidate the entire output</li>
        <li>{d.method('Persist Manifest(s)')} - Ensure the manifest is available for the compiler to leverage. Multiple will be written if in a monorepo</li>
        <li>{d.method('Invoke Compiler')} - Run {d.library('Typescript')} compiler with the aforementioned enhancements</li>
      </ul>
    </c.Section>
  </>;
};