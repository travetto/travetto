import { doc as d, mod, Section, Snippet, Code, lib } from '@travetto/doc';
import { RestApplication } from '@travetto/rest';

exports.text = d`
The module is an ${lib.Express} provider for the ${mod.Rest} module.  This module provides an implementation of ${RestApplication} for automatic injection in the default Rest server.

${Section('Customizing Rest App')}

${Code('Customizing the Express App', 'doc/customize.ts')}

${Section('Default Middleware')}
When working with an ${lib.Express} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${Snippet('Configured Middleware', 'src/server.ts', /const app\s*=/, /bodyParser.raw/)}

${Section('Extension - AWS Lambda')}
The ${lib.Express} module supports integration with ${lib.AwsServerlessExpress} when installed.  This produces an instance of ${RestApplication} that is able to integrate with AWS appropriately.
`;
