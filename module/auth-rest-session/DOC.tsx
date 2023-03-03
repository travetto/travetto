/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

import { SessionPrincipalEncoder } from './src/principal-encoder';

export const text = <>
  <c.StdHeader />
  One of {d.mod('AuthRest')}'s main responsibilities is being able to send and receive authentication/authorization information from the client.  This data can be encoded in many different forms, and this module provides the ability to encode into and decode from the user's {d.mod('RestSession')} context. This module fulfills the contract required by {d.mod('AuthRest')} of being able to encode and decode a user principal by storing the user principal in the session. <br />

  The {SessionPrincipalEncoder} is exposed as a tool for allowing for decoding/encoding principals into the session.

  <c.Code title={SessionPrincipalEncoder.name} src={SessionPrincipalEncoder} />

  As you can see, encode and decode just read and write from the session context.  The main feature here, is that if the authentication expires, the session should be destroyed.  Additionally, the user's expiry time is assumed to live as long as the session for simplicity's sake.
</>;
