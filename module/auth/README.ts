import { doc as d, Mod, Code, inp, SnippetLink, Section, Method, List } from '@travetto/doc';
import { AuthContext } from './src/context';
import { PrincipalSource } from './src/principal';
import { AuthUtil } from './src/util';

const Principal = SnippetLink('Principal', './src/types.ts', /interface Principal/);
const Identity = SnippetLink('Identity', './src/types.ts', /interface Identity/);

export default d`
This module provides the high-level backdrop for managing security principals.  The goal of this module is to be a centralized location for various security frameworks to plug into.  The primary contributions are:

${List(
  'Interfaces for standard security primitive',
  d`Patterns for producing a ${Principal}`,
  d`Common security-related utilities for ${List(
    `Checking permissions`,
    `Generating passwords`
  )}`
)}

${Section('Interfaces / Primitives')}
The module's goal is to be as flexible as possible.  To that end, the primary contract that this module defines, is that of the ${AuthContext}.

${Code('Auth context structure', AuthContext.ᚕfile, true)}

As referenced above, a ${Principal} is defined as a user with respect to a security context.  This is generally understood to be the information that the application knows about a user, specifically the configuration the application has about a user.

Comparatively, ${Identity} is defined as an authenticated user session that can be provided by the application or derived from some other source.  In simpler systems the identity will be equal to the principal, but in systems where you support 3rd party logins (e.g. Google/Facebook/Twitter/etc.) your identity will be external to the system.

Overall, the structure is simple, but drives home the primary use cases of the framework.  The goals are:
${List(
  `Be able to identify a user uniquely`,
  `To have a reference to a user's set of permissions`,
  `To have access to the raw principal`,
  `To have access to the raw identity`,
)}

${Section('Customization')}
By default, the module does not provide an implementation for the ${PrincipalSource}. By default the structure of the provider can be boiled down to:

${Code('Principal Source', PrincipalSource.ᚕfile, true)}

The provider only requires one method to be defined, and that is ${Method('resolvePrincipal')}.  This method receives an identity as an input, and is responsible for converting that to a principal (external user to internal user).  If you want to be able to auto-provision users from a remote source, you can set ${inp`autoCreate`} to ${inp`true`}, and supply ${Method('createPrincipal')}'s functionality for storing the user as well.

The ${Mod('auth-model')} module is a good example of a principal provider that is also an identity source.  This is a common use case for simple internal auth.

${Section('Common Utilities')}
The ${AuthUtil} provides the following functionality:

${Code('Auth util structure', AuthUtil.ᚕfile, true)}

${Method('permissionSetChecker')} is probably the only functionality that needs to be explained. The function operates in a ${inp`DENY`} / ${inp`ALLOW`} mode.  This means that a permission check will succeed only if:

${List(
  d`The user is logged in  ${List(
    d`If ${inp`matchAll`} is false: ${List(
      `The user does not have any permissions in the exclusion list`,
      `The include list is empty, or the user has at least one permission in the include list.`
    )}`,
    d`Else ${List(
      `The user does not have all permissions in the exclusion list`,
      `The include list is empty, or the user has all permissions in the include list.`
    )}`
  )}`
)}`;