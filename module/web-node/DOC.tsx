/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { WebRequest, WebResponse } from '@travetto/web';

export const text = <>
  <c.StdHeader />
  The module is an {d.library('Http')} adapter for the {d.mod('Web')} module.  This module provides will run an {d.library('Http')} or {d.library('Https')} server using {d.library('Node')} primitives.

  <c.Code title="Node Web Application" src="./src/application.ts"></c.Code>

  In the handler code, you can see that the main work is:
  <ul>
    <li>Converting the node primitive request to a  {WebRequest}</li>
    <li>Dispatching the request through the framework</li>
    <li>Receiving the {WebResponse} and sending that back over the primitive response.</li>
  </ul>
</>;
