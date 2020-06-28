import { d, Library, Snippet } from '@travetto/doc';

const JWT = Library('JWT', 'https://jwt.io/');
const NodeJWT = Library('node-jsonwebtoken', 'https://github.com/auth0/node-jsonwebtoken');

export default d`
This module is a simple component to support ${JWT} signing and verification.  The framework provides a port of ${NodeJWT}. The API has been streamlined, and is intended as a lower level component as a basis for other modules.

The API exposes:

${Snippet('Signing Options', 'src/types.ts', /export.*SignOptions/, /^[}]/)}
${Snippet('Signing API', 'src/sign.ts', /export.*function sign/)}
${Snippet('Verify Options', 'src/types.ts', /export.*VerifyOptions/, /^[}]/)}
${Snippet('Verify API', 'src/verify.ts', /export.*function verify/)}
`;
