import { d, mod } from '@travetto/doc';

import { ModelRoutes } from '@travetto/rest-model';

export const text = d`
${d.Header()}

To facilitate common RESTful patterns, the module exposes  ${mod.Model} support in the form of ${ModelRoutes}.

${d.Code('ModelRoutes example', 'src/controller-with-model.ts')}

is a shorthand that is equal to:

${d.Code('Comparable UserController, built manually', 'src/controller-without-model.ts')}
`;
