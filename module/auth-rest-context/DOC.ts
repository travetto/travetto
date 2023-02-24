import { Injectable } from '@travetto/di';
import { d, mod } from '@travetto/doc';
import { AuthContextService } from '@travetto/auth-rest-context';

export const text = () => d`
${d.Header()}

This module exposes a service ${AuthContextService} that is ${Injectable}, and will provide access to the user's authentication context without access to the request object.  This is extremely useful for auditing, logging, and other enforcement patterns. 

This module intercepts the ${d.Field('auth')} field on the http request object, and persists it using the ${mod.Context} module, meaning this information is now able to be retrieved outside of the normal execution flow, while the http request is still processing.

${d.Code(AuthContextService.name, AuthContextService)}
`;
