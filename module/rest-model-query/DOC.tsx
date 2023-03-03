/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { ModelQueryRoutes } from './src/model-query';

export const text = <>
  <c.StdHeader />
  {d.mod('ModelQuery')} support can also be added support in the form of {ModelQueryRoutes}. This provides listing by query as well as an endpoint to facilitate suggestion behaviors.

  <c.Code title='ModelQueryRoutes example' src='doc/controller-with-model-query.ts' />

  is a shorthand that is equal to:

  <c.Code title='Comparable UserController, built manually' src='doc/controller-without-model-query.ts' />
</>;
