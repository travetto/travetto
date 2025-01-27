/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { Context } from '@travetto/rest';
import { Session } from '@travetto/auth-session';


const ModelExpirySupport = d.ref('ModelExpirySupport', '@travetto/model/src/service/expiry.ts');

const Request = d.codeLink('Request', 'src/trv.d.ts', /interface Request/);
const SessionData = d.codeLink('SessionData', 'src/session.ts', /interface SessionData/);

export const text = <>
  <c.StdHeader />
  This is a module that adds session support to the {d.mod('Rest')} framework.  Sessions allow for persistent data across multiple requests.  Within the framework the sessions are stored against any {d.mod('Model')} implementation that provides {ModelExpirySupport}, as the data needs to be able to be expired appropriately.  The list of supported model providers are:
  <ul>
    <li>{d.mod('ModelRedis')}</li>
    <li>{d.mod('ModelMongo')}</li>
    <li>{d.mod('ModelS3')}</li>
    <li>{d.mod('ModelDynamodb')}</li>
    <li>{d.mod('ModelElasticsearch')}</li>
    <li>{d.mod('ModelFile')}</li>
    <li>{d.mod('ModelMemory')}</li>
  </ul>

  A session allows for defining the expiration time, what state the session should be in, as well as the payload (session data).  The session and session data are accessible via the {Context} parameter as {Session} and {SessionData} respectively.  Iit can also be accessed via the {Request} as a session property.

  <c.Code title='Sample Session Usage' src='doc/usage.ts' />

  This usage should be comparable to {d.library('Express')}, {d.library('Koa')} and mostly every other framework.

  <c.Section title='Session Configuration'>

    The module supports a general set of configuration that should cover the majority of session behaviors:

    <c.Code title='Session Config' src='src/config.ts' />

    These are all configurable via the {d.input('rest.session.*')} config values.  And as a note, in production, a secret is required to be specified.
  </c.Section>
</>;