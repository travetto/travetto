/** @jsxImportSource @travetto/doc */
import { d, c, mod } from '@travetto/doc';
import { Links } from '@travetto/model/support/doc.support.ts';
import { AuthModelUtil } from '@travetto/auth-model';

const RegisteredPrincipal = <c.Code title='Registered Principal' src='src/model.ts' startRe={/interface RegisteredPrincipal/} endRe={/^[}]/} />;

export const text = <>
  <c.StdHeader />
  This module supports the integration between the {d.mod('Auth')} module and the {d.mod('Model')}. <br />

  The asset module requires a {Links.Crud}-model to provide functionality for reading and storing user information. You can use any existing providers to serve as your {Links.Crud}, or you can roll your own.

  <c.Install title='provider' pkg='@travetto/model-{provider}' />

  Currently, the following are packages that provide {Links.Crud}:
  <ul>
    <li>{d.mod('ModelDynamodb')} - {mod.ModelDynamodb.name}</li>
    <li>{d.mod('ModelElasticsearch')} - {mod.ModelElasticsearch.name}</li>
    <li>{d.mod('ModelFirestore')} - {mod.ModelFirestore.name}</li>
    <li>{d.mod('ModelMongo')} - {mod.ModelMongo.name}</li>
    <li>{d.mod('ModelRedis')} - {mod.ModelRedis.name}</li>
    <li>{d.mod('ModelS3')} - {mod.ModelS3.name}</li>
    <li>{d.mod('ModelMysql')} - {mod.ModelMysql.name}</li>
    <li>{d.mod('ModelPostgres')} - {mod.ModelPostgres.name}</li>
    <li>{d.mod('ModelSqlite')} - {mod.ModelSqlite.name}</li>
    <li>{d.mod('ModelMemory')} - {mod.ModelMemory.name}</li>
    <li>{d.mod('ModelFile')} - {mod.ModelFile.name}</li>
  </ul>

  The module itself is fairly straightforward, and truly the only integration point for this module to work is defined at the model level.  The contract for authentication is established in code as providing translation to and from a {d.codeLink(RegisteredPrincipal)}. <br />

  A registered principal extends the base concept of an principal, by adding in additional fields needed for local registration, specifically password management information.

  {RegisteredPrincipal}

  <c.Code title='A valid user model' src='doc/model.ts' />

  <c.Section title='Configuration'>

    Additionally, there exists a common practice of mapping various external security principals into a local contract. These external identities, as provided from countless authentication schemes, need to be homogenized for use.  This has been handled in other frameworks by using external configuration, and creating a mapping between the two set of fields.  Within this module, the mappings are defined as functions in which you can translate to the model from an identity or to an identity from a model.

    <c.Code title='Principal Source configuration' src='doc/config.ts' />

    <c.Code title='Sample usage' src='doc/usage.ts' />
  </c.Section>

  <c.Section title='Common Utilities'>
    The {AuthModelUtil} provides the following functionality:

    <c.Code title='Auth util structure' src={AuthModelUtil} outline={true} />
  </c.Section>
</>;