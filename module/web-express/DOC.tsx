/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { WebApplication } from '@travetto/web';

export const text = <>
  <c.StdHeader />
  The module is an {d.library('Express')} provider for the {d.mod('Web')} module.  This module provides an implementation of {WebApplication} for automatic injection in the default Web server.

  <c.Section title='Customizing Web App'>
    <c.Code title='Customizing the Express App' src='doc/customize.ts' />
  </c.Section>

  <c.Section title='Default Middleware'>
    When working with an {d.library('Express')} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

    <c.Code title='Configured Middleware' src='src/server.ts' startRe={/const app\s*=/} endRe={/compress/} />
  </c.Section>
</>;
