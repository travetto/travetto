/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

import { AuthUtil } from '@travetto/auth/src/util';

const Principal = <c.Code title='Principal Structure' src='@travetto/auth/src/types/principal.ts' startRe={/interface Principal/} endRe={/^}/} />;
const Authenticator = <c.Code title='Authenticator' src='@travetto/auth/src/types/authenticator.ts' startRe={/interface Authenticator/} endRe={/^}/} />;
const Authorizer = <c.Code title='Authorizer' src='@travetto/auth/src/types/authorizer.ts' startRe={/interface Authorizer/} endRe={/^}/} />;

export const text = <>
  <c.StdHeader />
  This module provides the high-level backdrop for managing security principals.  The goal of this module is to be a centralized location for various security frameworks to plug into.  The primary contributions are:

  <ul>
    <li>Standard Types</li>
    <li>Authentication Contract</li>
    <li>Authorization Contract</li>
    <li>Common security-related utilities for
      <ul>
        <li>Checking permissions</li>
        <li>Generating passwords</li>
      </ul>
    </li>
  </ul>

  <c.Section title='Standard Types'>
    The module's goal is to be as flexible as possible.  To that end, the primary contract that this module defines, is that of the {d.codeLink(Principal)}.

    {Principal}

    As referenced above, a {d.codeLink(Principal)} is defined as a user with respect to a security context. This can be information the application knows about the user (authorized) or what a separate service may know about a user (3rd-party authentication).
  </c.Section>

  <c.Section title='Authentication'>

    {Authenticator}

    The {d.codeLink(Authenticator)} only requires one method to be defined, and that is {d.method('authenticate')}. This method receives a generic payload, and a supplemental context as an input. The interface is responsible for converting that to an authenticated principal.

    <c.SubSection title='Example'>
      The {d.mod('Jwt')} module is a good example of an authenticator. This is a common use case for simple internal auth.
    </c.SubSection>
  </c.Section>

  <c.Section title='Authorization'>

    {Authorizer}

    Authorizers are generally seen as a secondary step post-authentication. Authentication acts as a very basic form of authorization, assuming the principal store is owned by the application. <br />

    The {d.codeLink(Authorizer)} only requires one method to be defined, and that is {d.method('authorizer')}. This method receives an authenticated principal as an input, and is responsible for converting that to an authorized principal.

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

  <c.Section title='Common Utilities'>
    The {AuthUtil} provides the following functionality:

    <c.Code title='Auth util structure' src={AuthUtil} outline={true} />

    {d.method('roleMatcher')} is probably the only functionality that needs to be explained.  The function extends the core allow/deny matcher functionality from {d.mod('Base')}'s Util class. <br />

    An example of role checks could be:

    <ul>
      <li>Admin</li>
      <li>!Editor</li>
      <li>Owner+Author</li>
    </ul>

    The code would check the list in order, which would result in the following logic:
    <ul>
      <li>If the user is an admin, always allow</li>
      <li>If the user has the editor role, deny</li>
      <li>If the user is both an owner and an author allow</li>
      <li>By default, deny due to the presence of positive checks</li>
    </ul>
  </c.Section>
</>;