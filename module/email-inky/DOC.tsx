/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />

  This module provides {d.library('Inky')} support via {d.library('JSX')} tags for integration with the {d.mod('EmailTemplate')} engine.

  <c.Code src='doc/sample.email.jsx' title='Sample Inky Template'>

  </c.Code>

  Please see the {d.library('Inky')} documentation for more information on the <a href="https://get.foundation/emails/docs/inky.html">component specifications.</a>

  <c.Section title='Template Extension Points'>

    The template extension points are defined at:

    <ol>
      <li>{d.path('email/main.scss')} - The entry point for adding, and overriding any {d.library('Sass')}</li>
      <li>{d.path('email/inky.wrapper.html')} - Provides direct access to override the entire base HTML document for all HTML emails.</li>
    </ol>

    In addition to the overrides, you can find the list of available settings at <c.Ref title='Github' href='https://github.com/foundation/foundation-emails/blob/develop/scss/settings/_settings.scss' />
  </c.Section>
</>;