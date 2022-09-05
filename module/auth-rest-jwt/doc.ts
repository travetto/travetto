import { d } from '@travetto/doc';

import { JWTPrincipalEncoder } from './src/principal-encoder';

export const text = d`
${d.Header()}

The ${JWTPrincipalEncoder} is exposed as a tool for allowing for converting an authenticated principal into a JWT, and back again.  This token does not own a session, but allows for encoding the auth state into JWT constructs.

`;
