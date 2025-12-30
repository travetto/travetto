/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';

import { AuthContext, AuthService, Principal, Authenticator, Authorizer } from '@travetto/auth';
import { toConcrete } from '@travetto/runtime';

const PrincipalContract = toConcrete<Principal>();
const AuthorizerContract = toConcrete<Authorizer>();
const AuthenticatorContract = toConcrete<Authenticator>();

export const text = <>
  <c.StdHeader />
  This module provides the high-level backdrop for managing security principals.  The goal of this module is to be a centralized location for various security frameworks to plug into.  The primary contributions are:

  <ul>
    <li>Standard Types</li>
    <li>Authentication Contract</li>
    <li>Authorization Contract</li>
    <li>Authorization Services</li>
    <li>Authorization Context</li>
  </ul>

  <c.Section title='Standard Types'>
    The module's goal is to be as flexible as possible.  To that end, the primary contract that this module defines, is that of the {PrincipalContract}.

    <c.Code src={PrincipalContract} />

    As referenced above, a {PrincipalContract} is defined as a user with respect to a security context. This can be information the application knows about the user (authorized) or what a separate service may know about a user (3rd-party authentication).
  </c.Section>

  <c.Section title='Authentication Contract'>

    <c.Code src={AuthenticatorContract} />

    The {AuthenticatorContract} only requires one method to be defined, and that is {d.method('authenticate')}. This method receives a generic payload, and a supplemental context as an input. The interface is responsible for converting that to an authenticated principal.

  </c.Section>

  <c.Section title='Authorization Contract'>

    <c.Code src={AuthorizerContract} />

    Authorizers are generally seen as a secondary step post-authentication. Authentication acts as a very basic form of authorization, assuming the principal store is owned by the application. <br />

    The {AuthorizerContract} only requires one method to be defined, and that is {d.method('authorize')}. This method receives an authenticated principal as an input, and is responsible for converting that to an authorized principal.

    <c.SubSection title='Example'>
      The {d.mod('Model')} extension is a good example of an authenticator. This is a common use case for simple internal auth. <br />

      Overall, the structure is simple, but drives home the primary use cases of the framework. The goals are:
      <ul>
        <li>Be able to identify a user uniquely</li>
        <li>To have a reference to a user's set of permissions</li>
        <li>To have access to the principal</li>
      </ul>
    </c.SubSection>
  </c.Section>

  <c.Section title='Authorization Services'>
    <c.Code src={AuthService} title='Authorization Service' outline />

    The {AuthService} operates as the owner of the current auth state for a given "request". "Request" here implies a set of operations over a period of time, with the http request/response model being an easy point of reference.  This could also tie to a CLI operation, or any other invocation that requires some concept of authentication and authorization. <br />

    The service allows for storing and retrieving the active {PrincipalContract}, and/or the actively persisted auth token.  This is extremely useful for other parts of the framework that may request authenticated information (if available).  {d.mod('AuthWeb')} makes heavy use of this state for enforcing endpoints when authentication is required. <br />

    <c.SubSection title='Login'>
      "Logging in" can be thought of going through the action of finding a single source that can authenticate the identity for the request credentials.  Some times there may be more than one valid source of authentication that you want to leverage, and the first one to authenticate wins. The {AuthService} operates in this fashion, in which a set of credentials and potential {AuthenticatorContract}s are submitted, and the service will attempt to authenticate.  <br />

      Upon successful authentication, an optional {AuthorizerContract} may be invoked to authorize the authenticated user.  The {AuthenticatorContract} is assumed to be only one within the system, and should be tied to the specific product you are building for.  The {AuthorizerContract} should be assumed to have multiple sources, and are generally specific to external third parties.  All of these values are collected via the {d.mod('Di')} module and will be auto-registered on startup. <br />

      If this process is too cumbersome or restrictive, manually authenticating and authorizing is still more than permissible, and setting the principal within the service is a logical equivalent to login.
    </c.SubSection>
  </c.Section>

  <c.Section title='Authorization Context'>
    When working with framework's authentication, the authenticated information is exposed via the {AuthContext}, object. <br />

    <c.Code src={AuthContext} outline title='Auth Context Outline' />

  </c.Section>
</>;