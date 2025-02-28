/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { PassportAuthenticator } from './src/authenticator';

export const text = <>
  <c.StdHeader />
  This is a primary integration for the {d.mod('AuthWeb')} module.  This is another level of scaffolding allowing for compatible authentication frameworks to integrate. <br />

  Within the node ecosystem, the most prevalent auth framework is {d.library('Passport')}.  With countless integrations, the desire to leverage as much of it as possible, is extremely high. To that end, this module provides support for {d.library('Passport')} baked in. Registering and configuring a {d.library('Passport')} strategy is fairly straightforward.

  <c.Code title='Sample Facebook/passport config' src='doc/conf.ts' />

  As you can see, {PassportAuthenticator} will take care of the majority of the work, and all that is required is:
  <ul>
    <li>Provide the name of the strategy (should be unique)</li>
    <li>Provide the strategy instance.</li>
    <li>The conversion functions which defines the mapping between external and local identities.</li>
  </ul>

  <c.Note>You will need to provide the callback for the strategy to ensure you pass the external principal back into the framework</c.Note>

  After that, the provider is no different than any other, and can be used accordingly.  Additionally, because {d.library('Passport')} runs first, in it's entirety, you can use the provider as you normally would any {d.library('Passport')} middleware.

  <c.Code title='Sample routes using Facebook/passport provider' src='doc/simple.ts' />
</>;
