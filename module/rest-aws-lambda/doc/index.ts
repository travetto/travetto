import { d, lib, mod } from '@travetto/doc';

export const text = d`
${d.Header()}

The module provides support basic support with AWS lambdas. When using one of the specific rest modules (e.g. ${mod.RestExpress}), you can install the appropriate lambda-related dependencies installed (e.g. ${lib.ServerlessExpress}) to enable integration with AWS.  Nothing in the code needs to be modified to support the AWS integration, but there are some limitations of using AWS Lambdas as HTTP handlers. 

${d.Section('Packaging Lambdas')}

${d.Execute('Invoking a Package Build', 'trv', ['pack', 'rest/lambda', '-h'])}
`;
