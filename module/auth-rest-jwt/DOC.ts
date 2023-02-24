import { d, lib, mod } from '@travetto/doc';

import { JWTPrincipalEncoder } from './src/principal-encoder';

export const text = () => d`
${d.Header()}

One of ${mod.AuthRest}'s main responsibilities is being able to send and receive authentication/authorization information from the client.  This data can be encoded in many different forms, and this module provides the ability to encode into and decode from ${lib.JWT}s. This module fulfills the contract required by ${mod.AuthRest} of being able to encode and decode a user principal, by leveraging ${mod.Jwt}'s token generation features.

The ${JWTPrincipalEncoder} is exposed as a tool for allowing for converting an authenticated principal into a JWT, and back again. 

${d.Code(JWTPrincipalEncoder.name, JWTPrincipalEncoder)}

As you can see, the encode token just creates a ${lib.JWT} based on the principal provided, and decoding verifies the token, and returns the principal.
`;
