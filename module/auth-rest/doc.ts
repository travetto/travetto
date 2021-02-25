import { doc as d, lib, Code, List, Note, mod, Section, Snippet, Method, inp, SnippetLink } from '@travetto/doc';
import { InjectableFactory } from '@travetto/di';
import { Context } from '@travetto/rest';
import { AuthContext } from '@travetto/auth/src/context';

import { AuthService } from './src/service';
import { Authenticate, Unauthenticated, Authenticated } from './src/decorator';
import { PassportIdentitySource } from './src/extension/passport/identity';

const Request = SnippetLink('TravettoRequest', '@travetto/rest/src/types.d.ts', /interface TravettoRequest/);
const Response = SnippetLink('TravettoResponse', '@travetto/rest/src/types.d.ts', /interface TravettoResponse/);
const Identity = SnippetLink('Identity', '@travetto/auth/src/types.ts', /interface Identity/);
const IdentitySource = SnippetLink('IdentitySource', './src/identity.ts', /interface IdentitySource/);

exports.text = d`

This is a primary integration for the ${mod.Auth} module.  This is another level of scaffolding allowing for compatible authentication frameworks to integrate.  

The integration with the ${mod.Rest} module touches multiple levels. Primarily:

${List(
  'Security information management',
  'Patterns for auth framework integrations',
  'Route declaration'
)}

${Section('Security information management')}
When working with framework's authentication, the user information is exposed via the ${Request} 
object.  The auth functionality is exposed on the request as the property ${inp`auth`}.

${Snippet('Structure of auth property on the request', './src/typings.d.ts', /interface TravettoRequest/, /^\s+[}]/)}

This allows for any filters/middleware to access this information without deeper knowledge of the framework itself.  Also, for performance benefits, the auth context can be stored in the user session as a means to minimize future lookups. If storing the entire principal in the session, it is best to keep the principal as small as possible.

When authenticating, with a multi-step process, it is useful to share information between steps.  The ${Method('loginContext')} property is intended to be a location in which that information is persisted. Currently only ${lib.Passport} support is included, when dealing with multi-step logins.

${Section('Patterns for Integration')}
Every external framework integration relies upon the ${IdentitySource} contract.  This contract defines the boundaries between both frameworks and what is needed to pass between. As stated elsewhere, the goal is to be as flexible as possible, and so the contract is as minimal as possible:

${Code('Structure for the Identity Source', IdentitySource)}

The only required method to be defined is the ${Method('authenticate')} method.  This takes in a ${Request} and ${Response}, and is responsible for:

${List(
  d`Returning an ${Identity} if authentication was successful`,
  'Throwing an error if it failed',
  'Returning undefined if the authentication is multi-staged and has not completed yet'
)}
A sample auth provider would look like:

${Code('Sample Identity Source', 'doc/source.ts')}

The provider must be registered with a custom symbol to be used within the framework.  At startup, all registered ${IdentitySource}'s are collected and stored for reference at runtime, via symbol. For example:

${Code('Potential Facebook provider', 'doc/facebook.ts')}

The symbol ${inp`FB_AUTH`} is what will be used to reference providers at runtime.  This was chosen, over ${inp`class`} references due to the fact that most providers will not be defined via a new class, but via an ${InjectableFactory} method.

${Section('Route Declaration')}
Like the ${AuthService}, there are common auth patterns that most users will implement. The framework has codified these into decorators that a developer can pick up and use.

${Authenticate} provides middleware that will authenticate the user as defined by the specified providers, or throw an error if authentication is unsuccessful.

${Code('Using provider with routes', 'doc/route.ts')}

${Authenticated} and ${Unauthenticated} will simply enforce whether or not a user is logged in and throw the appropriate error messages as needed. Additionally, ${AuthContext} is accessible via ${Context} directly, without wiring in a request object, but is also accessible on the request object as ${Request}.auth.

${Section('Passport - Extension')}

Within the node ecosystem, the most prevalent auth framework is ${lib.Passport}.  With countless integrations, the desire to leverage as much of it as possible, is extremely high. To that end, this module provides support for ${lib.Passport} baked in. Registering and configuring a ${lib.Passport} strategy is fairly straightforward.

${Code('Sample Facebook/passport config', 'doc/passport/conf.ts')}

As you can see, ${PassportIdentitySource} will take care of the majority of the work, and all that is required is:
${List(
  'Provide the name of the strategy (should be unique)',
  d`Provide the strategy instance. ${Note('you will need to provide the callback for the strategy to ensure you pass the external principal back into the framework')}`,
  'The conversion functions which defines the mapping between external and local identities.'
)}

After that, the provider is no different than any other, and can be used accordingly.  Additionally, because ${lib.Passport} runs first, in it's entirety, you can use the provider as you normally would any ${lib.Passport} middleware.

${Code('Sample routes using Facebook/passport provider', 'doc/passport/simple.ts')}
`;
