/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { WebRequest, WebResponse } from '@travetto/web';
import { NodeWebServer } from '@travetto/web-node';

export const text = <>
  <c.StdHeader />
  The module is an {d.library('NodeHttp')} adapter for the {d.mod('Web')} module.  This module provides will run an {d.library('NodeHttp')} or {d.library('NodeHttps')} server using {d.library('Node')} primitives.

  <c.Code title="Node Web Server" src={NodeWebServer}></c.Code>

  In the handler code, you can see that the main work is:
  <ul>
    <li>Converting the node primitive request to a  {WebRequest}</li>
    <li>Dispatching the request through the framework</li>
    <li>Receiving the {WebResponse} and sending that back over the primitive response.</li>
  </ul>
</>;
