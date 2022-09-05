import '@travetto/model-query';

import { d, mod } from '@travetto/doc';

import { ModelQueryRoutes } from './src/model-query';

export const text = d`
${d.Header()}

${mod.ModelQuery} support can also be added support in the form of ${ModelQueryRoutes}. This provides listing by query as well as an endpoint to facilitate suggestion behaviors.

${d.Code('ModelQueryRoutes example', 'doc/controller-with-model-query.ts')}

is a shorthand that is equal to:

${d.Code('Comparable UserController, built manually', 'doc/controller-without-model-query.ts')}

`;
