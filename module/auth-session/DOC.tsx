/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { AuthContext } from '@travetto/auth';
import { Runtime } from '@travetto/runtime';

import { SessionService } from './src/service.ts';

const PrincipalContract = d.codeLink('Principal', '@travetto/auth/src/types/principal.ts', /interface Principal/);
const ModelExpirySupport = d.ref('ModelExpirySupport', '@travetto/model/src/service/expiry.ts');

export const text = <>
  <c.StdHeader />
  This is a module that adds session support to the {d.mod('Auth')} framework, via {d.mod('Model')} storage.  The concept here, is that the {d.mod('Auth')} module provides the solid foundation for ensuring authentication to the system, and transitively to the session data. The {PrincipalContract} provides a session identifier, which refers to a unique authentication session.  Each login will produce a novel session id.  This id provides the contract between {d.mod('Auth')} and{d.mod('AuthSession')}.  <br />

  This session identifier, is then used when retrieving data from {d.mod('Model')} storage. This storage mechanism is not tied to a request/response model, but the {d.mod('AuthRestSession')} does provide a natural integration with the {d.mod('Rest')} module.   <br />

  Within the framework the sessions are stored against any {d.mod('Model')} implementation that provides {ModelExpirySupport}, as the data needs to be able to be expired appropriately.  The list of supported model providers are:

  <ul>
    <li>{d.mod('ModelRedis')}</li>
    <li>{d.mod('ModelMongo')}</li>
    <li>{d.mod('ModelS3')}</li>
    <li>{d.mod('ModelDynamodb')}</li>
    <li>{d.mod('ModelElasticsearch')}</li>
    <li>{d.mod('ModelFile')}</li>
    <li>{d.mod('ModelMemory')}</li>
  </ul>

  While the expiry is not necessarily a hard requirement, the implementation without it can be quite messy.  To that end, the ability to add {ModelExpirySupport} to the model provider would be the natural extension point if more expiry support is needed.

  <c.Code src={Runtime.workspaceRelative('module/auth-rest-session/src/interceptor.ts')} startRe={/class/} endRe={/^[}]/} title='Sample usage of Session Service' />

  The {SessionService} provides the basic integration with the {AuthContext} to authenticate and isolate session data.  The usage is fairly simple, but the import pattern to follow is:
  <ul>
    <li>load</li>
    <li>read/modify</li>
    <li>persist</li>
  </ul>

  And note, persist is intelligent enough to only update the data store if the expiration date has changed or if the data in the session has been modified.
</>;