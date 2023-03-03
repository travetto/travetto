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
    Extending the {d.input('cli')} is fairly straightforward.  It is built upon {d.library('Commander')}, with a model that is extensible:

    <c.Code title='Echo Command' src='doc/echo.ts' />

    With the corresponding output:

    <c.Execution title='Echo Command Help' cmd='trv' args={['echo', '--help']} config={cfg} />

    And actually using it:

    <c.Execution title='Echo Command Run' cmd='trv' args={['echo', '-u', 'bOb', 'rOb', 'DRoP']} config={cfg} />
  </c.Section>
</>;