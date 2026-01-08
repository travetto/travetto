/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { InjectableFactory, Injectable } from '@travetto/di';
import { ContextParam, WebRequest, WebResponse } from '@travetto/web';
import {
  Login, Unauthenticated, Authenticated, Logout, WebAuthConfig,
  JWTPrincipalCodec, AuthContextInterceptor, type PrincipalCodec
} from '@travetto/auth-web';
import { toConcrete } from '@travetto/runtime';
import { AuthContext, type Authenticator, type AuthenticatorState, type Principal } from '@travetto/auth';

const PrincipalContract = toConcrete<Principal>();
const PrincipalCodecContract = toConcrete<PrincipalCodec>();
const AuthenticatorContract = toConcrete<Authenticator>();
const AuthenticatorStateContract = toConcrete<AuthenticatorState>();
const WebRequestContract = toConcrete<WebRequest>();

export const text = <>
  <c.StdHeader />
  This is a primary integration for the {d.mod('Auth')} module with the {d.mod('Web')} module. <br />

  The integration with the {d.mod('Web')} module touches multiple levels. Primarily:

  <ul>
    <li>Authenticating</li>
    <li>Maintaining Auth Context</li>
    <li>Endpoint Decoration</li>
    <li>Multi-Step Login</li>
  </ul>

  <c.Section title='Authenticating'>
    Every external framework integration relies upon the {AuthenticatorContract} contract.  This contract defines the boundaries between both frameworks and what is needed to pass between. As stated elsewhere, the goal is to be as flexible as possible, and so the contract is as minimal as possible:

    <c.Code title='Structure for the Identity Source' src='@travetto/auth/src/types/authenticator.ts' />

    The only required method to be defined is the {d.method('authenticate')} method.  This takes in a pre-principal payload and a filter context with a {WebRequestContract}, and is responsible for:

    <ul>
      <li>Returning an {PrincipalContract} if authentication was successful</li>
      <li>Throwing an error if it failed</li>
      <li>Returning undefined if the authentication is multi-staged and has not completed yet</li>
    </ul>

    A sample auth provider would look like:

    <c.Code title='Sample Identity Source' src='doc/source.ts' />

    The provider must be registered with a custom symbol to be used within the framework.  At startup, all registered {AuthenticatorContract}'s are collected and stored for reference at runtime, via symbol. For example:

    <c.Code title='Potential Facebook provider' src='doc/facebook.ts' />

    The symbol {d.input('FB_AUTH')} is what will be used to reference providers at runtime.  This was chosen, over {d.input('class')} references due to the fact that most providers will not be defined via a new class, but via an {InjectableFactory} method.
  </c.Section>

  <c.Section title='Maintaining Auth Context'>
    The {AuthContextInterceptor} acts as the bridge between the {d.mod('Auth')} and {d.mod('Web')} modules.  It serves to take an authenticated principal (via the {WebRequest}/{WebResponse}) and integrate it into the {AuthContext}. Leveraging {WebAuthConfig}'s configuration allows for basic control of how the principal is encoded and decoded, primarily with the choice between using a header or a cookie, and which header, or cookie value is specifically referenced.  Additionally, the encoding process allows for auto-renewing of the token (on by default). The information is encoded into the {d.library('JWT')} appropriately, and when encoding using cookies, is also  set as the expiry time for the cookie.  <br />

    <strong>Note for Cookie Use:</strong> The automatic renewal, update, seamless receipt and transmission of the {PrincipalContract} cookie act as a light-weight session.  Generally the goal is to keep the token as small as possible, but for small amounts of data, this pattern proves to be fairly sufficient at maintaining a decentralized state. <br />

    The {PrincipalCodecContract} contract is the primary interface for reading and writing {PrincipalContract} data out of the {WebRequestContract}. This contract is flexible by design, allowing for all sorts of usage. {JWTPrincipalCodec} is the default {PrincipalCodecContract}, leveraging {d.library('JWT')}s for encoding/decoding the principal information.

    <c.Code src={JWTPrincipalCodec} startRe={/./} />

    As you can see, the encode token just creates a {d.library('JWT')} based on the principal provided, and decoding verifies the token, and returns the principal. <br />

    A trivial/sample custom {PrincipalCodecContract} can be seen here:

    <c.Code title='Custom Principal Codec' src='doc/codec.ts' />

    This implementation is not suitable for production, but shows the general pattern needed to integrate with any principal source.

  </c.Section>

  <c.Section title='Endpoint Decoration'>
    {Login} integrates with middleware that will authenticate the user as defined by the specified providers, or throw an error if authentication is unsuccessful.<br />

    {Logout} integrates with middleware that will automatically deauthenticate a user, throw an error if the user is unauthenticated.

    <c.Code title='Using provider with endpoints' src='doc/endpoints.ts' />

    {Authenticated} and {Unauthenticated} will simply enforce whether or not a user is logged in and throw the appropriate error messages as needed. Additionally, the {PrincipalContract} is accessible as a resource that can be exposed as a {ContextParam} on an {Injectable} class.
  </c.Section>

  <c.Section title='Multi-Step Login'>
    When authenticating, with a multi-step process, it is useful to share information between steps.  The {d.field('authenticatorState')} of {AuthContext} field is intended to be a location in which that information is persisted. Currently only {d.library('Passport')} support is included, when dealing with multi-step logins. This information can also be injected into a web endpoint method, using the {AuthenticatorStateContract} type;
  </c.Section>
</>;
