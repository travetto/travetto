const { doc: d, lib, Snippet } = require('@travetto/doc');

exports.text = d`
This module is a simple component to support ${lib.JWT} signing and verification.  The framework provides a port of ${lib.NodeJWT}. The API has been streamlined, and is intended as a lower level component as a basis for other modules.

The API exposes:

${Snippet('Signing Options', 'src/types.ts', /export.*SignOptions/, /^[}]/)}
${Snippet('Signing API', 'src/sign.ts', /export.*function sign/)}
${Snippet('Verify Options', 'src/types.ts', /export.*VerifyOptions/, /^[}]/)}
${Snippet('Verify API', 'src/verify.ts', /export.*function verify/)}
`;
