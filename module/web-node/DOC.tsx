/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { toConcrete } from '@travetto/runtime';
import { WebApplication } from '@travetto/web';

const WebApplicationContract = toConcrete<WebApplication>();

export const text = <>
  <c.StdHeader />
  The module is an {d.library('Node')} provider for the {d.mod('Web')} module.  This module provides an implementation of {WebApplicationContract} for automatic injection in the default Web server.
</>;
