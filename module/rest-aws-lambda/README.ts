import { doc as d, Mod, Section, Snippet, lib } from '@travetto/doc';

export default d`
The module is an ${lib.AwsServerlessExpress} provider for the ${Mod('rest')} module.

${Section('Default Middleware')}
When working with an ${lib.Express} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${Snippet('Configured Middleware', './src/server.ts', /const app\s*=/, /awsServerlessExpressMiddleware/)}
`;
