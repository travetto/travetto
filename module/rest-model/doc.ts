import { d, mod } from '@travetto/doc';

import { ModelRoutes } from './src/model';

export const text = d`
${d.Header()}

To facilitate common RESTful patterns, the module exposes  ${mod.Model} support in the form of ${ModelRoutes}.

${d.Code('ModelRoutes example', 'doc/controller-with-model.ts')}

is a shorthand that is equal to:

${d.Code('Comparable UserController, built manually', 'doc/controller-without-model.ts')}
`;
