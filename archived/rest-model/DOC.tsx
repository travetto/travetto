/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

import { ModelRoutes } from './src/model';

export const text = <>
  <c.StdHeader />
  To facilitate common RESTful patterns, the module exposes  {d.mod('Model')} support in the form of {ModelRoutes}.

  <c.Code title='ModelRoutes example' src='doc/controller-with-model.ts' />

  is a shorthand that is equal to:

  <c.Code title='Comparable UserController, built manually' src='doc/controller-without-model.ts' />
</>;
