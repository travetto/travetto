import { d, Library, Mod, SubSection, Section, Snippet } from '@travetto/doc';

export default d`
The module is an ${Library(`aws-serverless-express`, 'https://github.com/awslabs/aws-serverless-express/blob/master/README.md')} provider for the ${Mod('rest')} module.

${Section('Default Middleware')}
When working with an ${Library(`express`, 'https://expressjs.com')} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

${Snippet('Configured Middleware', './src/server.ts', /const app\s*=/, /awsServerlessExpressMiddleware/)}
`;
