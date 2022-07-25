import { d, mod, lib } from '@travetto/doc';

import { FileModelService } from './src/provider/file';
import { MemoryModelService } from './src/provider/memory';
import { Model } from './src/registry/decorator';

import { Links } from './support/doc-support';

const ModelTypeSnippet = d.Snippet('ModelType', './src/types/model.ts', /export interface/, /^}/);

export const text = d`
${d.Header()}

This module provides a set of contracts/interfaces to data model persistence, modification and retrieval.  This module builds heavily upon the ${mod.Schema}, which is used for data model validation.

${d.Section('Contracts')}

The module is mainly composed of contracts.  The contracts define the expected interface for various model patterns. The primary contracts are ${Links.Basic}, ${Links.Crud}, ${Links.Indexed}, ${Links.Expiry}, ${Links.Stream} and ${Links.Bulk}.

${d.SubSection(Links.Basic)}
All ${mod.Model} implementations, must honor the BasicCrud contract to be able to participate in the model ecosystem.  This contract represents the bare minimum for a model service.

${d.Snippet('Basic Contract', './src/service/basic.ts', /export interface ModelBasic/, /^}/)}

${d.SubSection(Links.Crud)}
The crud contract, builds upon the basic contract, and is built around the idea of simple data retrieval and storage, to create a foundation for other services that need only basic support.  The model extension in ${mod.Auth}, is an example of a module that only needs create, read and delete, and so any implementation of ${mod.Model} that honors this contract, can be used with the ${mod.Auth} model extension.

${d.Snippet('Crud Contract', './src/service/crud.ts', /export interface ModelCrud/, /^}/)}

${d.SubSection(Links.Indexed)}
Additionally, an implementation may support the ability for basic indexed queries. This is not the full featured query support of ${mod.ModelQuery}, but
allowing for indexed lookups.  This does not support listing by index, but may be added at a later date.  

${d.Snippet('Indexed Contract', './src/service/indexed.ts', /export interface ModelIndexed/, /^}/)}

${d.SubSection(Links.Expiry)}

Certain implementations will also provide support for automatic expiry of data at runtime.  This is extremely useful for temporary data as, and is used in the ${mod.Cache} module for expiring data accordingly.

${d.Snippet('Expiry Contract', './src/service/expiry.ts', /export interface ModelExpiry/, /^}/)}

${d.SubSection(Links.Stream)}

Some implementations also allow for the ability to read/write binary data as a stream.  Given that all implementations can store ${lib.Base64} encoded data, the key differentiator here, is native support for streaming data, as well as being able to store binary data of significant sizes.  This pattern is currently used by ${mod.Asset} for reading and writing asset data.

${d.Snippet('Stream Contract', './src/service/stream.ts', /export interface ModelStream/, /^}/)}

${d.SubSection(Links.Bulk)}

Finally, there is support for bulk operations.  This is not to simply imply issuing many commands at in parallel, but implementation support for an atomic/bulk operation.  This should allow for higher throughput on data ingest, and potentially for atomic support on transactions.  

${d.Snippet('Bulk Contract', './src/service/bulk.ts', /export interface ModelBulk/, /^}/)}

${d.Section('Declaration')}
Models are declared via the ${Model} decorator, which allows the system to know that this is a class that is compatible with the module.  The only requirement for a model is the ${ModelTypeSnippet.link}

${ModelTypeSnippet}

All fields are optional, but the ${d.Field('id')} and ${d.Field('type')} are important as those field types are unable to be changed.  This may make using existing data models impossible if types other than strings are required.  Additionally, the type field, is intended to record the base model type and cannot be remapped. This is important to support polymorphism, not only in ${mod.Model}, but also in ${mod.Schema}.

${d.Section('Implementations')}

${d.Table(
  ['Service', 'Basic', 'CRUD', 'Indexed', 'Expiry', 'Stream', 'Bulk'],
  [mod.ModelDynamodb, 'X', 'X', 'X', 'X', ' ', ' '],
  [mod.ModelElasticsearch, 'X', 'X', 'X', 'X', ' ', 'X'],
  [mod.ModelFirestore, 'X', 'X', 'X', ' ', ' ', ' '],
  [mod.ModelMongo, 'X', 'X', 'X', 'X', 'X', 'X'],
  [mod.ModelRedis, 'X', 'X', 'X', 'X', ' ', ''],
  [mod.ModelS3, 'X', 'X', ' ', 'X', 'X', ' '],
  [mod.ModelSql, 'X', 'X', 'X', 'X', ' ', 'X'],
  [d`${MemoryModelService}`, 'X', 'X', 'X', 'X', 'X', 'X'],
  [d`${FileModelService}`, 'X', 'X', ' ', 'X', 'X', 'X']
)}

${d.Section('Custom Model Service')}
In addition to the provided contracts, the module also provides common utilities and shared test suites.  The common utilities are useful for
repetitive functionality, that is unable to be shared due to not relying upon inheritance (this was an intentional design decision).  This allows for all the ${mod.Model} implementations to completely own the functionality and also to be able to provide additional/unique functionality that goes beyond the interface.

${d.Code('Memory Service', './src/provider/memory.ts', true)}

To enforce that these contracts are honored, the module provides shared test suites to allow for custom implementations to ensure they are adhering to the contract's expected behavior.

${d.Code('Memory Service Test Configuration', './test/memory.ts')}

${d.Section('CLI - model:export')}

The module provides the ability to generate an export of the model structure from all the various ${Model}s within the application.  This is useful for being able to generate the appropriate files to manually create the data schemas in production.

${d.Execute('Running model export', 'trv', ['model:export', '--help'])}

${d.Section('CLI - model:install')}

The module provides the ability to install all the various ${Model}s within the application given the current configuration being targeted.  This is useful for being able to prepare the datastore manually.

${d.Execute('Running model install', 'trv', ['model:install', '--help'])}
`;