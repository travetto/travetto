import { d, mod } from '@travetto/doc';
import { RestApplication } from '@travetto/rest/src/application/rest';

export const text = d`
${d.Header()}

This module provides support for ${mod.RestFastify} + ${mod.RestAwsLambda}.  This produces an instance of ${RestApplication} that is able to integrate with AWS appropriately. 
`;