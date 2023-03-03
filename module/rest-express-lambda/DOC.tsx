/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { RestApplication } from '@travetto/rest';

export const text = <>
  <c.StdHeader />
  The {d.library('Express')} module supports AWS lambda integration when installed.  This produces an instance of {RestApplication} that is able to integrate with AWS appropriately.
</>;
