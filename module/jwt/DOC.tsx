/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

export const text = <>
  <c.StdHeader />
  This module is a simple component to support {d.library('JWT')} signing and verification.  The framework provides a port of {d.library('NodeJWT')}. The API has been streamlined, and is intended as a lower level component as a basis for other modules. <br />

  The API exposes:
  <c.Code title='Signing Options' src='src/types.ts' startRe={/export.*SignOptions/} endRe={/^[}]/} />
  <c.Code title='Verify Options' src='src/types.ts' startRe={/export.*VerifyOptions/} endRe={/^[}]/} />
  <c.Code title='API' src='src/util.ts' startRe={/export.*class JWTUtil/} endRe={/^[}]/} outline={true} />
</>;
