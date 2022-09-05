import { d, lib, mod } from '@travetto/doc';
import { InjectableFactory } from '@travetto/di';
import { Context } from '@travetto/rest';

import { AuthService } from './src/service';
import { Authenticate, Unauthenticated, Authenticated } from './src/decorator';

const Principal = d.SnippetLink('Principal', '@travetto/auth/src/types/principal.ts', /interface Principal/);
const Request = d.SnippetLink('TravettoRequest', '@travetto/rest/src/types.d.ts', /interface TravettoRequest/);
const Response = d.SnippetLink('TravettoResponse', '@travetto/rest/src/types.d.ts', /interface TravettoResponse/);
const Authenticator = d.SnippetLink('Authenticator', '@travetto/auth/src/types/authenticator.ts', /interface Authenticator/);

export const text = d`
${d.Header()}

This is a primary integration for the ${mod.Auth} module.  This is another level of scaffolding allowing for compatible authentication frameworks to integrate.  

The integration with the ${mod.Rest} module touches multiple levels. Primarily:

${d.List(
  'Security information management',
  'Patterns for auth framework integrations',
  'Route declaration'
)}

${d.Section('Security information management')}
When working with framework's authentication, the user information is exposed via the ${Request} 
object.  The auth functionality is exposed on the request as the property ${d.Input('auth')}.

${d.Snippet('Structure of auth property on the request', './src/typings.d.ts', /interface TravettoRequest/, /^\s+[}]/)}

This allows for any filters/middleware to access this information without deeper knowledge of the framework itself.  Also, for performance benefits, the auth context can be stored in the user session as a means to minimize future lookups. If storing the entire principal in the session, it is best to keep the principal as small as possible.

When authenticating, with a multi-step process, it is useful to share information between steps.  The ${d.Method('loginContext')} property is intended to be a location in which that information is persisted. Currently only ${lib.Passport} support is included, when dealing with multi-step logins.

${d.Section('Patterns for Integration')}
Every external framework integration relies upon the ${Authenticator} contract.  This contract defines the boundaries between both frameworks and what is needed to pass between. As stated elsewhere, the goal is to be as flexible as possible, and so the contract is as minimal as possible:

${d.Code('Structure for the Identity Source', Authenticator)}

The only required method to be defined is the ${d.Method('authenticate')} method.  This takes in a ${Request} and ${Response}, and is responsible for:

${d.List(
  d`Returning an ${Principal} if authentication was successful`,
  'Throwing an error if it failed',
  'Returning undefined if the authentication is multi-staged and has not completed yet'
)}
A sample auth provider would look like:

${d.Code('Sample Identity Source', 'doc/source.ts')}

The provider must be registered with a custom symbol to be used within the framework.  At startup, all registered ${Authenticator}'s are collected and stored for reference at runtime, via symbol. For example:

${d.Code('Potential Facebook provider', 'doc/facebook.ts')}

The symbol ${d.Input('FB_AUTH')} is what will be used to reference providers at runtime.  This was chosen, over ${d.Input('class')} references due to the fact that most providers will not be defined via a new class, but via an ${InjectableFactory} method.

${d.Section('Route Declaration')}
Like the ${AuthService}, there are common auth patterns that most users will implement. The framework has codified these into decorators that a developer can pick up and use.

${Authenticate} provides middleware that will authenticate the user as defined by the specified providers, or throw an error if authentication is unsuccessful.

${d.Code('Using provider with routes', 'doc/route.ts')}

${Authenticated} and ${Unauthenticated} will simply enforce whether or not a user is logged in and throw the appropriate error messages as needed. Additionally, the ${Principal} is accessible via ${Context} directly, without wiring in a request object, but is also accessible on the request object as ${Request}.auth.
`;
