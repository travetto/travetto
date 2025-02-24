/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { RestApplication } from '@travetto/rest';

export const text = <>
  <c.StdHeader />
  This module provides support for {d.mod('RestFastify')} + {d.mod('RestAwsLambda')}.  This produces an instance of {RestApplication} that is able to integrate with AWS appropriately.
</>;