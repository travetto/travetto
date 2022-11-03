import { d, mod } from '@travetto/doc';
import { ModelQueryRoutes } from '@travetto/rest-model-query';

export const text = d`
${d.Header()}

${mod.ModelQuery} support can also be added support in the form of ${ModelQueryRoutes}. This provides listing by query as well as an endpoint to facilitate suggestion behaviors.

${d.Code('ModelQueryRoutes example', 'src/controller-with-model-query.ts')}

is a shorthand that is equal to:

${d.Code('Comparable UserController, built manually', 'src/controller-without-model-query.ts')}

`;
