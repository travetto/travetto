import { d, lib } from '@travetto/doc';

export const text = d`
${d.Header()}

This module is a simple component to support ${lib.JWT} signing and verification.  The framework provides a port of ${lib.NodeJWT}. The API has been streamlined, and is intended as a lower level component as a basis for other modules.

The API exposes:

${d.Snippet('Signing Options', 'src/types.ts', /export.*SignOptions/, /^[}]/)}
${d.Snippet('Signing API', 'src/sign.ts', /export.*function sign/)}
${d.Snippet('Verify Options', 'src/types.ts', /export.*VerifyOptions/, /^[}]/)}
${d.Snippet('Verify API', 'src/verify.ts', /export.*function verify/)}
`;
