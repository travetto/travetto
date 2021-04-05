import { d, mod } from '@travetto/doc';

import { AuthContext } from './src/context';
import { AuthUtil } from './src/util';

const PrincipalSource = d.SnippetLink('PrincipalSource', './src/types.ts', /interface PrincipalSource/);
const Principal = d.SnippetLink('Principal', './src/types.ts', /interface Principal/);
const Identity = d.SnippetLink('Identity', './src/types.ts', /interface Identity/);

export const text = d`
${d.Header()}

This module provides the high-level backdrop for managing security principals.  The goal of this module is to be a centralized location for various security frameworks to plug into.  The primary contributions are:

${d.List(
  'Interfaces for standard security primitive',
  d`Patterns for producing a ${Principal}`,
  d`Common security-related utilities for ${d.List(
    'Checking permissions',
    'Generating passwords'
  )}`
)}

${d.Section('Interfaces / Primitives')}
The module's goal is to be as flexible as possible.  To that end, the primary contract that this module defines, is that of the ${AuthContext}.

${d.Code('Auth context structure', AuthContext.ᚕfile, true)}

As referenced above, a ${Principal} is defined as a user with respect to a security context.  This is generally understood to be the information that the application knows about a user, specifically the configuration the application has about a user.

Comparatively, ${Identity} is defined as an authenticated user session that can be provided by the application or derived from some other source.  In simpler systems the identity will be equal to the principal, but in systems where you support 3rd party logins (e.g. Google/Facebook/Twitter/etc.) your identity will be external to the system.

Overall, the structure is simple, but drives home the primary use cases of the framework.  The goals are:
${d.List(
  'Be able to identify a user uniquely',
  'To have a reference to a user\'s set of permissions',
  'To have access to the raw principal',
  'To have access to the raw identity',
)}

${d.Section('Customization')}
By default, the module does not provide an implementation for the ${PrincipalSource}. By default the structure of the provider can be boiled down to:

${d.Code('Principal Source', PrincipalSource.link, true)}

The provider only requires one method to be defined, and that is ${d.Method('resolvePrincipal')}.  This method receives an identity as an input, and is responsible for converting that to a principal (external user to internal user).  If you want to be able to auto-provision users from a remote source, you can set ${d.Input('autoCreate')} to ${d.Input('true')}, and supply ${d.Method('createPrincipal')}'s functionality for storing the user as well.

The ${mod.AuthModel} module is a good example of a principal provider that is also an identity source.  This is a common use case for simple internal auth.

${d.Section('Common Utilities')}
The ${AuthUtil} provides the following functionality:

${d.Code('Auth util structure', AuthUtil.ᚕfile, true)}

${d.Method('permissionSetChecker')} is probably the only functionality that needs to be explained. The function operates in a ${d.Input('DENY')} / ${d.Input('ALLOW')} mode.  This means that a permission check will succeed only if:

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
)}`;