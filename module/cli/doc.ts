import { d, lib } from '@travetto/doc';

export const text = d`
${d.Header()}

The cli is the primary structure for interacting with the external requirements of the framework.  This can range from running tests, to running applications, to generating email templates. The main executable can be installed globally or locally.  If installed globally and locally, it will defer to the local installation for execution.

As is the custom, modules are able to register their own cli extensions as scripts, whose name starts with ${d.Path('cli.')}.  These scripts are then picked up at runtime and all available options are provided when viewing the help documentation.  The following are all the supported cli operations and the various settings they allow.

${d.Section('General')}

${d.Execute('General Usage', 'trv', ['--help'])}

This will show all the available options/choices that are exposed given the currently installed modules.

${d.Section('Extending')}

Extending the ${d.Input('cli')} is fairly straightforward.  It is built upon ${lib.Commander}, with a model that is extensible:

${d.Code('Echo Command', 'doc/bin/cli-echo.ts')}

With the corresponding output:

${d.Execute('Echo Command Help', 'trv', ['echo', '--help'])}

And actually using it:

${d.Execute('Echo Command Run', 'trv', ['echo', '-u', 'bOb', 'rOb', 'DRoP'])}

`;