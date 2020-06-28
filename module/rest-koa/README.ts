import { d, Library, Mod, Section, Snippet, Code } from '@travetto/doc';
import { RestServer } from '@travetto/rest/src/server/server';

const Koa = Library(`koa`, 'https://koajs.com/')

export default d`
The module is an ${Koa} provider for the ${Mod('rest')} module.  This module provides an implementation of ${RestServer} for automatic injection in the default Rest server.

${Section('Customizing Rest App')}

${Code('Customizing the Koa App', 'alt/docs/src/customize.ts')}

${Section('Default Middleware')}
When working with an ${Koa} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${Snippet('Configured Middleware', './src/server.ts', /const app\s*=/, /bodyParser/i)}
`;