import { d, mod } from '@travetto/doc';

import { Links } from '@travetto/model/support/doc-support';

export const text = d`
${d.Header()}

This module provides the integration between the ${mod.Auth} module and the ${mod.Model}. 

The asset module requires an ${Links.Crud} to provide functionality for reading and storing user information. You can use any existing providers to serve as your ${Links.Crud}, or you can roll your own.

${d.Install('provider', '@travetto/model-{provider}')}

Currently, the following are packages that provide ${Links.Crud}:
${d.List(
  d`${mod.ModelDynamodb} - @travetto/model-dynamodb`,
  d`${mod.ModelElasticsearch} @travetto/model-elasticsearch`,
  d`${mod.ModelFirestore} @travetto/model-firestore`,
  d`${mod.ModelMongo} @travetto/model-mongo`,
  d`${mod.ModelRedis} @travetto/model-redis`,
  d`${mod.ModelS3} @travetto/model-s3`,
  d`${mod.ModelSql} @travetto/model-sql`,
)}

The module itself is fairly straightforward, and truly the only integration point for this module to work is defined at the model level.  The contract for authentication is established in code as providing translation to and from a ${d.SnippetLink('RegisteredIdentity', './src/identity.ts', /interface RegisteredIdentity/)}

A registered identity extends the base concept of an identity, by adding in additional fields needed for local registration, specifically password management information.

${d.Snippet('Registered Identity', 'src/identity.ts', /interface RegisteredIdentity/, /^[}]/)}

${d.Code('A valid user model', 'doc/model.ts')}

${d.Section('Configuration')}

Additionally, there exists a common practice of mapping various external security principals into a local contract. These external identities, as provided from countless authentication schemes, need to be homogeonized for use.  This has been handled in other frameworks by using external configuration, and creating a mapping between the two set of fields.  Within this module, the mappings are defined as functions in which you can translate to the model from an identity or to an identity from a model.

${d.Code('Principal Source configuration', 'doc/config.ts')}

${d.Code('Sample usage', 'doc/usage.ts')}
`;