import { d, Library, Mod, Section, Snippet, Code } from '@travetto/doc';
import { RestServer } from '@travetto/rest/src/server/server';

const Express = Library(`express`, 'https://expressjs.com/')

export default d`
The module is an ${Express} provider for the ${Mod('rest')} module.  This module provides an implementation of ${RestServer} for automatic injection in the default Rest server.

${Section('Customizing Rest App')}

${Code('Customizing the Express App', 'alt/docs/src/customize.ts')}

${Section('Default Middleware')}
When working with an ${Express} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${Snippet('Configured Middleware', './src/server.ts', /const app\s*=/, /bodyParser.raw/)}
`;
