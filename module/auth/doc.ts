import { d, mod } from '@travetto/doc';

import { AuthUtil } from './src/util';

const Principal = d.Snippet('Principal Structure', './src/types/principal.ts', /interface Principal/, /^}/);
const Authorizer = d.Snippet('Authorizer', './src/types/authorizer.ts', /interface Authorizer/, /^}/);
const Authenticator = d.Snippet('Authenticator', './src/types/authenticator.ts', /interface Authenticator/, /^}/);

export const text = d`
${d.Header()}

This module provides the high-level backdrop for managing security principals.  The goal of this module is to be a centralized location for various security frameworks to plug into.  The primary contributions are:

${d.List(
  'Standard Types',
  d`Authentication Contract`,
  d`Authorization Contract`,
  d`Common security-related utilities for ${d.List(
    'Checking permissions',
    'Generating passwords'
  )}`
)}

${d.Section('Standard Types')}
The module's goal is to be as flexible as possible.  To that end, the primary contract that this module defines, is that of the ${Principal.link}.

${Principal}

As referenced above, a ${Principal.link} is defined as a user with respect to a security context. This can be information the application knows about the user (authorized) or what a separate service may know about a user (3rd-party authentication).

${d.Section('Authentication')}

${Authenticator}

The ${Authenticator.link} only requires one method to be defined, and that is ${d.Method('authenticate')}. This method receives a generic payload, and a supplemental context as an input. The interface is responsible for converting that to an authenticated principal.

${d.SubSection('Example')}
The ${mod.Jwt} module is a good example of an authenticator. This is a common use case for simple internal auth.

${d.Section('Authorization')}

${Authorizer}
Authorizers are generally seen as a secondary step post-authentication. Authentication acts as a very basic form of authorization, assuming the principal store is owned by the application.

The ${Authorizer.link} only requires one method to be defined, and that is ${d.Method('authorizer')}. This method receives an authenticated principal as an input, and is responsible for converting that to an authorized principal.

${d.SubSection('Example')}
The ${mod.Model} extension is a good example of an authenticator. This is a common use case for simple internal auth.

Overall, the structure is simple, but drives home the primary use cases of the framework. The goals are:
${d.List(
  'Be able to identify a user uniquely',
  'To have a reference to a user\'s set of permissions',
  'To have access to the principal',
)}


${d.Section('Common Utilities')}
The ${AuthUtil} provides the following functionality:

${d.Code('Auth util structure', AuthUtil.ᚕfile, true)}

${d.Method('permissionSetChecker')} is probably the only functionality that needs to be explained.The function operates in a ${d.Input('DENY')} / ${d.Input('ALLOW')} mode.  This means that a permission check will succeed only if:

${d.List(
  d`The user is logged in  ${d.List(
    d`If ${d.Input('matchAll')} is false: ${d.List(
      'The user does not have any permissions in the exclusion list',
      'The include list is empty, or the user has at least one permission in the include list.'
    )}`,
    d`Else ${d.List(
      'The user does not have all permissions in the exclusion list',
      'The include list is empty, or the user has all permissions in the include list.'
    )}`
  )}`
)} 
`;