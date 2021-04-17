import { d, mod, lib } from '@travetto/doc';
import { Context } from '@travetto/rest/src/decorator/param';
import '@travetto/model';

import { Session } from '.';

const Request = d.SnippetLink('TravettoRequest', 'src/types.d.ts', /interface TravettoRequest/);
const SessionData = d.SnippetLink('SessionData', 'src/session.ts', /interface SessionData/);

export const text = d`
${d.Header()}

This is a module that adds session support to the ${mod.Rest} framework.  Sessions are represented as:

${d.Snippet('Session Structure', 'src/session.ts', /class Session\b/, /^\}/, true)}

A session allows for defining the expiration time, what state the session should be in, as well as the payload (session data).  The session and session data are accessible via the ${Context} parameter as ${Session} and ${SessionData} respectively.  Iit can also be accessed via the ${Request} as a session property.

${d.Code('Sample Session Usage', 'doc/usage.ts')}

This usage should be comparable to ${lib.Express}, ${lib.Koa} and mostly every other framework.

${d.Section('Configuration')}

Session mechanics are defined by the underlying provider.
`;