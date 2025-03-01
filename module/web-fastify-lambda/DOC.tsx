/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { WebApplication } from '@travetto/web';

export const text = <>
  <c.StdHeader />
  This module provides support for {d.mod('WebFastify')} + {d.mod('WebAwsLambda')}.  This produces an instance of {WebApplication} that is able to integrate with AWS appropriately.
</>;