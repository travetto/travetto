/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

import { JWTPrincipalEncoder } from './src/principal-encoder';

export const text = <>
  <c.StdHeader />
  One of {d.mod('AuthRest')}'s main responsibilities is being able to send and receive authentication/authorization information from the client.  This data can be encoded in many different forms, and this module provides the ability to encode into and decode from {d.library('JWT')}s. This module fulfills the contract required by {d.mod('AuthRest')} of being able to encode and decode a user principal, by leveraging {d.mod('Jwt')}'s token generation features. <br />

  The {JWTPrincipalEncoder} is exposed as a tool for allowing for converting an authenticated principal into a JWT, and back again.

  <c.Code title={JWTPrincipalEncoder.name} src={JWTPrincipalEncoder} />

  As you can see, the encode token just creates a {d.library('JWT')} based on the principal provided, and decoding verifies the token, and returns the principal.
</>;