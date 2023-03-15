/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

const cfg = { cwd: './doc-exec' };

export const text = <>
  <c.StdHeader />
  The cli is the primary structure for interacting with the external requirements of the framework.  This can range from running tests, to running applications, to generating email templates. The main executable can be installed globally or locally.  If installed globally and locally, it will defer to the local installation for execution. <br />

  As is the custom, modules are able to register their own cli extensions as scripts, whose name starts with {d.path('cli.')}.  These scripts are then picked up at runtime and all available options are provided when viewing the help documentation.  The following are all the supported cli operations and the various settings they allow.

  <c.Section title='General'>
    <c.Execution title='General Usage' cmd='trv' args={['--help']} config={cfg} />

    This will show all the available options/choices that are exposed given the currently installed modules.
  </c.Section>

  <c.Section title='Extending'>
    Extending the {d.input('cli')} is fairly straightforward.  It is built upon {d.mod('Schema')}, with a model that is extensible:

    <c.Code title='Echo Command' src='doc/echo.ts' />

    With the corresponding output:

    <c.Execution title='Echo Command Help' cmd='trv' args={['echo', '--help']} config={cfg} />

    And actually using it:

    <c.Execution title='Echo Command Run' cmd='trv' args={['echo', '-u', 'bOb', 'rOb', 'DRoP']} config={cfg} />
  </c.Section>


  <c.Section title='main() Arguments'>
    The arguments specified in the {d.method('main')} method are extracted via code transformation, and are able to be bound when invoking the application.  Whether from the command line or a plugin, the parameters will be mapped to the inputs of {d.method('main')}.  For instance:

    <c.Code title='Simple Entry Point with Parameters' src='doc/domain.ts' />
  </c.Section>

  <c.Section title='Type Checking'>
    The parameters to {d.method('main')} will be type checked, to ensure proper evaluation.

    <c.Execution title='Invoke Simple with bad port' cmd='trv' args={['run', 'simple-domain', 'my-domain.biz', 'orange']}
      config={{ cwd: './doc-exec' }} />

    The types are inferred from the {d.method('.main()')} method parameters:

    <ul>
      <li>{d.input('number')} - Float or decimal</li>
      <li>{d.input('string')} - Default if no type is specified</li>
      <li>{d.input('boolean')} - true(yes/on/1) and false(no/off/0)</li>
      <li>{d.input('union')} - Type unions of the same type ({d.input('string_a | string_b')} or {d.input('1 | 2 | 3 | 4')})</li>
    </ul>

    Customizing the types is done by name, and allows for greater control:

    <c.Code title='Complex Entry Point with Customization' src='doc/complex.ts' />
  </c.Section>
</>;