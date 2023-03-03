/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { InjectableFactory } from '@travetto/di';
import { Context } from '@travetto/rest';
import { AuthService, Authenticate, Unauthenticated, Authenticated } from '@travetto/auth-rest';
import { RootIndex } from '@travetto/manifest';

const Principal = d.codeLink('Principal', '@travetto/auth/src/types/principal.ts', /interface Principal/);
const Request = d.codeLink('TravettoRequest', `${RootIndex.getModule('@travetto/rest')?.sourcePath}/src/typings.d.ts`, /interface TravettoRequest/);
const Response = d.codeLink('TravettoResponse', `${RootIndex.getModule('@travetto/rest')?.sourcePath}/src/typings.d.ts`, /interface TravettoResponse/);
const Authenticator = d.codeLink('Authenticator', '@travetto/auth/src/types/authenticator.ts', /interface Authenticator/);

export const text = <>
  <c.StdHeader />
  This is a primary integration for the {d.mod('Auth')} module.  This is another level of scaffolding allowing for compatible authentication frameworks to integrate. <br />

  The integration with the {d.mod('Rest')} module touches multiple levels. Primarily:

  <ul>
    <li>Security information management</li>
    <li>Patterns for auth framework integrations</li>
    <li>Route declaration</li>
  </ul>

  <c.Section title='Security information management'>
    When working with framework's authentication, the user information is exposed via the {Request}
    object.  The auth functionality is exposed on the request as the property {d.input('auth')}.

    <c.Code title='Structure of auth property on the request' src='src/typings.d.ts' startRe={/interface TravettoRequest/} endRe={/^\s+[}]/} />

    This allows for any filters/middleware to access this information without deeper knowledge of the framework itself.  Also, for performance benefits, the auth context can be stored in the user session as a means to minimize future lookups. If storing the entire principal in the session, it is best to keep the principal as small as possible. <br />

    When authenticating, with a multi-step process, it is useful to share information between steps.  The {d.method('loginContext')} property is intended to be a location in which that information is persisted. Currently only {d.library('Passport')} support is included, when dealing with multi-step logins.
  </c.Section>

  <c.Section title='Patterns for Integration'>
    Every external framework integration relies upon the {Authenticator} contract.  This contract defines the boundaries between both frameworks and what is needed to pass between. As stated elsewhere, the goal is to be as flexible as possible, and so the contract is as minimal as possible:

    <c.Code title='Structure for the Identity Source' src='@travetto/auth/src/types/authenticator.ts' />

    The only required method to be defined is the {d.method('authenticate')} method.  This takes in a pre-principal payload and a filter context with a {Request} and {Response}, and is responsible for:

    <ul>
      <li>Returning an {Principal} if authentication was successful</li>
      <li>Throwing an error if it failed</li>
      <li>Returning undefined if the authentication is multi-staged and has not completed yet</li>
    </ul>
    A sample auth provider would look like:

    <c.Code title='Sample Identity Source' src='doc/source.ts' />

    The provider must be registered with a custom symbol to be used within the framework.  At startup, all registered {Authenticator}'s are collected and stored for reference at runtime, via symbol. For example:

    <c.Code title='Potential Facebook provider' src='doc/facebook.ts' />

    The symbol {d.input('FB_AUTH')} is what will be used to reference providers at runtime.  This was chosen, over {d.input('class')} references due to the fact that most providers will not be defined via a new class, but via an {InjectableFactory} method.
  </c.Section>

  <c.Section title='Route Declaration'>
    Like the {AuthService}, there are common auth patterns that most users will implement. The framework has codified these into decorators that a developer can pick up and use. <br />

    {Authenticate} integrates with middleware that will authenticate the user as defined by the specified providers, or throw an error if authentication is unsuccessful.

    <c.Code title='Using provider with routes' src='doc/route.ts' />

    {Authenticated} and {Unauthenticated} will simply enforce whether or not a user is logged in and throw the appropriate error messages as needed. Additionally, the {Principal} is accessible via {Context} directly, without wiring in a request object, but is also accessible on the request object as {Request}.auth.
  </c.Section>
</>;
