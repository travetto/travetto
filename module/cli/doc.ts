import { doc as d, pth, inp, Execute, Section, lib, Code } from '@travetto/doc';

exports.text = d`

The cli is the primary structure for interacting with the external requirements of the framework.  This can range from running tests, to running applications, to generating email templates. The main executable can be installed globally or locally.  If installed globally and locally, it will defer to the local installation for execution.

As is the custom, modules are able to register their own cli extensions as scripts, whose name starts with ${pth`cli-`}.  These scripts are then picked up at runtime and all available options are provided when viewing the help documentation.  The following are all the supported cli operations and the various settings they allow.

${Section('General')}

${Execute('General Usage', 'travetto', ['--help'])}

This will show all the available options/choices that are exposed given the currently installed modules.

${Section('Extending')}

Extending the ${inp`cli`} is fairly straightforward.  It is built upon ${lib.Commander}, with a plugin model that is extensible:

${Code('Echo Plugin', 'doc/bin/cli-echo.ts')}

With the corresponding output:

${Execute('Echo Plugin Help', 'travetto', ['echo', '--help'])}

And actually using it:

${Execute('Echo Plugin Run', 'travetto', ['echo', '-u', 'bOb', 'rOb', 'DRoP'])}

`;