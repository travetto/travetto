import { d, mod, lib } from '@travetto/doc';
import { FileModelService, MemoryModelService } from '@travetto/model';
import { Context } from '@travetto/rest';
import { Session } from '@travetto/rest-session';


const ModelExpirySupport = d.Ref('ModelExpirySupport', '@travetto/model/src/service/expiry.ts');

const Request = d.SnippetLink('TravettoRequest', 'src/typings.d.ts', /interface TravettoRequest/);
const SessionData = d.SnippetLink('SessionData', 'src/session.ts', /interface SessionData/);

export const text = () => d`
${d.Header()}

This is a module that adds session support to the ${mod.Rest} framework.  Sessions allow for persistent data across multiple requests.  Within the framework the sessions are stored against any ${mod.Model} implementation that provides ${ModelExpirySupport}, as the data needs to be able to be expired appropriately.  The list of supported model providers are: 
${d.List(
  d`${mod.Model}'s ${FileModelService} and ${MemoryModelService}`,
  d`${mod.ModelRedis}`,
  d`${mod.ModelMongo}`,
  d`${mod.ModelS3}`,
  d`${mod.ModelDynamodb}`,
  d`${mod.ModelElasticsearch}`,
)}

A session allows for defining the expiration time, what state the session should be in, as well as the payload (session data).  The session and session data are accessible via the ${Context} parameter as ${Session} and ${SessionData} respectively.  Iit can also be accessed via the ${Request} as a session property.

${d.Code('Sample Session Usage', 'doc/usage.ts')}

This usage should be comparable to ${lib.Express}, ${lib.Koa} and mostly every other framework.

${d.Section('Session Configuration')}

The module supports a general set of configuration that should cover the majority of session behaviors:

${d.Code('Session Config', 'src/config.ts')}

These are all configurable via the ${d.Input('rest.session.*')} config values.  And as a note, in production, a secret is required to be specified.
`;