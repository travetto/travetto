import { d, lib } from '@travetto/doc';
import { JWTPrincipalEncoder } from './src/extension/auth-rest';

export const text = d`
${d.Header()}

This module is a simple component to support ${lib.JWT} signing and verification.  The framework provides a port of ${lib.NodeJWT}. The API has been streamlined, and is intended as a lower level component as a basis for other modules.

The API exposes:

${d.Snippet('Signing Options', 'src/types.ts', /export.*SignOptions/, /^[}]/)}
${d.Snippet('Verify Options', 'src/types.ts', /export.*VerifyOptions/, /^[}]/)}
${d.Snippet('API', 'src/util.ts', /export.*class JWTUtil/, /^[}]/, true)}

${d.Section('Extension - Auth Rest')}

The ${JWTPrincipalEncoder} is exposed as a tool for allowing for converting an authenticated principal into a JWT, and back again.  This token does not own a session, but allows for encoding the auth state into JWT constructs.
`;
