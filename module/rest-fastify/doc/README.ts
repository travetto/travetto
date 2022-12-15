import { d, lib, mod } from '@travetto/doc';
import { RestApplication } from '@travetto/rest/src/application/rest';

export const text = () => d`
${d.Header()}

The module is an ${lib.Fastify} provider for the ${mod.Rest} module.  This module provides an implementation of ${RestApplication} for automatic injection in the default Rest server.

${d.Section('Customizing Rest App')}

${d.Code('Customizing the Fastify App', 'src/customize.ts')}

${d.Section('Default Middleware')}
When working with an ${lib.Fastify} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${d.Snippet('Configured Middleware', '@travetto/rest-fastify/src/server.ts', /const app\s*=/, /addContentTypeParser/)}
`;