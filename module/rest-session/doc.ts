import { d, mod, lib } from '@travetto/doc';
import { Context } from '@travetto/rest/src/decorator/param';
import '@travetto/model';

import { Session } from '.';
import { StatelessSessionProvider } from './src/provider/stateless';
import { ModelSessionProvider } from './src/model';

const Request = d.SnippetLink('TravettoRequest', 'src/types.d.ts', /interface TravettoRequest/);
const SessionData = d.SnippetLink('SessionData', 'src/types.ts', /interface SessionData/);
const SessionProvider = d.SnippetLink('SessionProvider', 'src/provider/types.ts', /interface SessionProvider/);

export const text = d`
${d.Header()}

This is a module that adds session support to the ${mod.Rest} framework.  Sessions are represented as:

${d.Snippet('Session Structure', 'src/types.ts', /class Session\b/, /^\}/, true)}

A session allows for defining the expiration time, what state the session should be in, as well as the payload (session data).  The session and session data are accessible via the ${Context} parameter as ${Session} and ${SessionData} respectively.  Iit can also be accessed via the ${Request} as a session property.

${d.Code('Sample Session Usage', 'doc/usage.ts')}

This usage should be comparable to ${lib.Express}, ${lib.Koa} and mostly every other framework.

${d.Section('Configuration')}

Session mechanics are defined by the underlying provider.

${d.SubSection('Building a Provider')}

Provider are pieces that enable you manage the session state, including interaction with the request/response. This allows for sessions to be read/written to cookies, headers, url parameters, etc. Additionally, this allows for persisting session data as needed. The structure for the provider is fairly straightforward:

${d.Code('Provider structure', SessionProvider.link)}

The provider will ${d.Method('encode')} the session into the response.  The ${d.Method('decode')} operation will then read the session from the request and reconstruct a fully defined ${Session} object.  This allows for storing the session data externally or internal to the app.

${d.Code('Stateless Session Provider', StatelessSessionProvider.ᚕfile)}

${d.Code('Model Session Provider', ModelSessionProvider.ᚕfile)}

`;