/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { RestApplication } from '@travetto/rest/src/application/rest';

export const text = <>
  <c.StdHeader />
  The module is an {d.library('Fastify')} provider for the {d.mod('Rest')} module.  This module provides an implementation of {RestApplication} for automatic injection in the default Rest server.

  <c.Section title='Customizing Rest App'>
    <c.Code title='Customizing the Fastify App' src='doc/customize.ts' />
  </c.Section>

  <c.Section title='Default Middleware'>
    When working with an {d.library('Fastify')} applications, the module provides what is assumed to be a sufficient set of basic filters. Specifically:

    <c.Code title='Configured Middleware' src='src/server.ts' startRe={/const app\s*=/} endRe={/addContentTypeParser/} />
  </c.Section>
</>;