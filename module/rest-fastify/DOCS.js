const { doc: d, lib, Mod, Section, Snippet, Code } = require('@travetto/doc');
const { RestServer } = require('@travetto/rest/src/server/base');


exports.text = d`
The module is an ${lib.Fastify} provider for the ${Mod('rest')} module.  This module provides an implementation of ${RestServer} for automatic injection in the default Rest server.

${Section('Customizing Rest App')}

${Code('Customizing the Fastify App', 'alt/docs/src/customize.ts')}

${Section('Default Middleware')}
When working with an ${lib.Fastify} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${Snippet('Configured Middleware', './src/server.ts', /const app\s*=/, /addContentTypeParser/)}

${Section('Extension - AWS Lambda')}
The ${lib.Fastify} module supports integration with ${lib.AwsLambdaFastify} when installed.  This produces an instance of ${RestServer} that is able to integrate with AWS appropriately. 
`;