import { doc as d, mod, Section, Snippet, Code, lib, Header } from '@travetto/doc';
import { RestApplication } from '@travetto/rest';

export const text = d`
${Header()}

The module is an ${lib.Koa} provider for the ${mod.Rest} module.  This module provides an implementation of ${RestApplication} for automatic injection in the default Rest server.

${Section('Customizing Rest App')}

${Code('Customizing the Koa App', 'doc/customize.ts')}

${Section('Default Middleware')}
When working with an ${lib.Koa} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${Snippet('Configured Middleware', 'src/server.ts', /const app\s*=/, /kCustomBody/i)}

${Section('Extension - AWS Lambda')}
The ${lib.Koa} module supports integration with ${lib.AwsServerlessExpress} when installed.  This produces an instance of ${RestApplication} that is able to integrate with AWS appropriately.
`;