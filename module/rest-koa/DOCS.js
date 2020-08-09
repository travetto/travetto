const { doc: d, Mod, Section, Snippet, Code, lib } = require('@travetto/doc');
const { RestServer } = require('@travetto/rest/src/server/server');

exports.text = d`
The module is an ${lib.Koa} provider for the ${Mod('rest')} module.  This module provides an implementation of ${RestServer} for automatic injection in the default Rest server.

${Section('Customizing Rest App')}

${Code('Customizing the Koa App', 'alt/docs/src/customize.ts')}

${Section('Default Middleware')}
When working with an ${lib.Koa} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${Snippet('Configured Middleware', './src/server.ts', /const app\s*=/, /bodyParser/i)}

${Section('Extension - AWS Lambda')}
The ${lib.Koa} module supports integration with ${lib.AwsServerlessExpress} when installed.  This produces an instance of ${RestServer} that is able to integrate with AWS appropriately.
`;