import { d, mod, lib } from '@travetto/doc';
import { RestApplication } from '@travetto/rest';

export const text = d`
${d.Header()}

The module is an ${lib.Express} provider for the ${mod.Rest} module.  This module provides an implementation of ${RestApplication} for automatic injection in the default Rest server.

${d.Section('Customizing Rest App')}

${d.Code('Customizing the Express App', 'doc/customize.ts')}

${d.Section('Default Middleware')}
When working with an ${lib.Express} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${d.Snippet('Configured Middleware', 'src/server.ts', /const app\s*=/, /bodyParser.raw/)}

${d.Section('Extension - AWS Lambda')}
The ${lib.Express} module supports integration with ${lib.ServerlessExpress} when installed.  This produces an instance of ${RestApplication} that is able to integrate with AWS appropriately.
`;
