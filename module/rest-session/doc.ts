import { doc as d, mod, Snippet, SnippetLink, Code, Section, SubSection, meth, lib, Header } from '@travetto/doc';
import { Context } from '@travetto/rest/src/decorator/param';
import { Cache, CacheService } from '@travetto/cache';

import { Session } from '.';
import { RequetSessionEncoder } from './src/encoder/request';

const Request = SnippetLink('TravettoRequest', 'src/types.d.ts', /interface TravettoRequest/);
const SessionData = SnippetLink('SessionData', 'src/types.ts', /interface SessionData/);
const SessionEncoder = SnippetLink('SessionEncoder', 'src/encoder/types.ts', /interface SessionEncoder/);

export const text = d`
${Header()}

This is a module that adds session support to the ${mod.Rest} framework.  Sessions are represented as:

${Snippet('Session Structure', 'src/types.ts', /class Session\b/, /^\}/, true)}

A session allows for defining the expiration time, what state the session should be in, as well as the payload (session data).  The session and session data are accessible via the ${Context} parameter as ${Session} and ${SessionData} respectively.  Iit can also be accessed via the ${Request} as a session property.

${Code('Sample Session Usage', 'doc/usage.ts')}

This usage should be comparable to ${lib.Express}, ${lib.Koa} and mostly every other framework.

${Section('Configuration')}

Session mechanics are defined by two main components, encoders and a cache source.  The encoders are provided within the module, but the stores are provided via the ${Cache} module.

By default, the module supplies the ${RequetSessionEncoder} and the ${CacheService} as default usage.

${SubSection('Building an Encoder')}

Encoders are pieces that enable you read/write the session state from the request/response.  This allows for sessions to be read/written to cookies, headers, url parameters, etc. The structure for the encoder is fairly straightforward:

${Code('Encoder structure', SessionEncoder.link)}

The encoder will ${meth`encode`} the session into the response, as a string.  The ${meth`decode`} operation will then read that string and either produce a session identifier (a string) or a fully defined ${Session} object.  This allows for storing the session data externally or internal to the app, and referencing it by a session identifier.

${Code('Standard Request Encoder', RequetSessionEncoder.ᚕfile)}

`;