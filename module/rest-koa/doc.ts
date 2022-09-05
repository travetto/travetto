import { d, mod, lib } from '@travetto/doc';
import { RestApplication } from '@travetto/rest';

export const text = d`
${d.Header()}

The module is an ${lib.Koa} provider for the ${mod.Rest} module.  This module provides an implementation of ${RestApplication} for automatic injection in the default Rest server.

${d.Section('Customizing Rest App')}

${d.Code('Customizing the Koa App', 'doc/customize.ts')}

${d.Section('Default Middleware')}
When working with an ${lib.Koa} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${d.Snippet('Configured Middleware', 'src/server.ts', /const app\s*=/, /kCompress/i)}
`;