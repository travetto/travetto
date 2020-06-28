import { d, Library, Mod, Section, Snippet, Code } from '@travetto/doc';
import { RestServer } from '@travetto/rest/src/server/server';

const Fastify = Library(`fastify`, 'https://www.fastify.io/')

export default d`
The module is an ${Fastify} provider for the ${Mod('rest')} module.  This module provides an implementation of ${RestServer} for automatic injection in the default Rest server.

${Section('Customizing Rest App')}

${Code('Customizing the Fastify App', 'alt/docs/src/customize.ts')}

${Section('Default Middleware')}
When working with an ${Fastify} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${Snippet('Configured Middleware', './src/server.ts', /const app\s*=/, /addContentTypeParser/)}
`;