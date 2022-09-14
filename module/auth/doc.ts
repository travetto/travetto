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

${d.Method('roleMatcher')} is probably the only functionality that needs to be explained.  The function extends the core allow/deny matcher functionality from ${mod.Base}'s Util class.  

An example of role checks could be:

${d.List(
  'Admin',
  '!Editor',
  'Owner+Author'
)}

The code would check the list in order, which would result in the following logic:
${d.List(
  'If the user is an admin, always allow',
  'If the user has the editor role, deny',
  'If the user is both an owner and an author allow',
  'By default, deny due to the presence of positive checks'
)} 
`;