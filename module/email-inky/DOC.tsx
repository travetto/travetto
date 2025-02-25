/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

const IfLink = <c.CodeLink src='./src/components.ts' startRe={/const If/} title='If Component' />;
const UnlessLink = <c.CodeLink src='./src/components.ts' startRe={/const Unless/} title='Unless Component' />;
const ForLink = <c.CodeLink src='./src/components.ts' startRe={/const For/} title='For Component' />;
const ValueLink = <c.CodeLink src='./src/components.ts' startRe={/const Value/} title='Value Component' />;

export const text = <>
  <c.StdHeader />

  This module provides {d.library('Inky')} support via {d.library('JSX')} tags for integration with the {d.mod('EmailCompiler')} engine.

  <c.Code src='doc/sample.email.tsx' title='Sample Inky Template'>

  </c.Code>

  Please see the {d.library('Inky')} documentation for more information on the <c.Anchor title='component specifications' href='https://get.foundation/emails/docs/inky.html'>component specifications.</c.Anchor>

  <c.Section title='Conditionals and Substitutions'>
    The underlying {d.mod('Email')} module is built on {d.library('Mustache')}, which provides enough flexibility to enable sufficient power with minimal complexity and overhead.<br />

    This means this module, while showing {d.library('Inky')} components, will ultimately produce HTML/markdown that is {d.library('Mustache')} compatible. The syntax used by {d.library('Mustache')} and the syntax used by {d.library('JSX')} are in conflict due to both of the tools relying on the uniqueness of {d.input('{}')} brackets.<br />

    To that end, the module introduces additional components ({IfLink}, {UnlessLink}, and {ForLink}) to assist with control flow logic.  When it comes to variable substitution, and a desire to intermingle seamlessly with component properties, {d.input('{{value}}')} can be used within a string value. To leverage substitutions outside of string contexts, a more formal version can be found in the {ValueLink} component, but this cannot be integrated into properties (e.g. an href).

  </c.Section>

  <c.Section title='Template Extension Points'>

    The template extension points are defined at:

    <ol>
      <li>{d.path('email/main.scss')} - The entry point for adding, and overriding any {d.library('Sass')}</li>
      <li>{d.path('email/inky.variables.scss')} - Allows for specifying any variables that should be defined before {d.library('Inky')}'s styles are loaded.</li>
      <li>{d.path('email/inky.wrapper.html')} - Provides direct access to override the entire base HTML document for all HTML emails.</li>
    </ol>

    In addition to the overrides, you can find the list of available settings at <c.Ref title='Github' href='https://github.com/foundation/foundation-emails/blob/develop/scss/settings/_settings.scss' />
  </c.Section>
</>;