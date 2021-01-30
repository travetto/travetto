import { doc as d, mod, Section, Code, inp, lib, List, SubSection, Table, Snippet, SnippetLink, fld } from '@travetto/doc';
import { FileModelService } from './src/provider/file';
import { MemoryModelService } from './src/provider/memory';
import { Model } from './src/registry/decorator';

import { Links } from './support/doc-support';

const ModelTypeSnippet = Snippet('ModelType', './src/types/model.ts', /export interface/, /}/)

exports.text = d`
This module provides a set of contracts/interfaces to data model persistence, modification and retrieval.  This module builds heavily upon the ${mod.Schema}, which is used for data model validation.

${Section('Contracts')}

The module is mainly composed of contracts.  The contracts define the expected interface for various model patterns. The primary contracts are ${Links.Basic}, ${Links.Crud}, ${Links.Indexed}, ${Links.Expiry}, ${Links.Stream} and ${Links.Bulk}.

${SubSection(Links.Basic)}
All ${mod.Model} implementations, must honor the BasicCrud contract to be able to participate in the model ecosystem.  This contract represents the bare minimum for a model service.

${Snippet('Basic Contract', './src/service/basic.ts', /export interface ModelBasic/, /}/)}

${SubSection(Links.Crud)}
The crud contract, builds upon the basic contract, and is built around the idea of simple data retrieval and storage, to create a foundation for other services that need only basic support.  ${mod.AuthModel}, is an example of a module that only needs create, read and delete, and so any implementation of ${mod.Model} that honors this contract, can be used with the ${mod.AuthModel}.

${Snippet('Crud Contract', './src/service/crud.ts', /export interface ModelCrud/, /}/)}

${SubSection(Links.Indexed)}
Additionally, an implementation may support the ability for basic indexed queries. This is not the full featured query support of ${mod.ModelQuery}, but
allowing for indexed lookups.  This does not support listing by index, but may be added at a later date.  

${Snippet('Indexed Contract', './src/service/indexed.ts', /export interface ModelIndexed/, /}/)}

${SubSection(Links.Expiry)}

Certain implementations will also provide support for automatic expiry of data at runtime.  This is extremely useful for temporary data as, and is used in the ${mod.Cache} module for expiring data accordingly.

${Snippet('Expiry Contract', './src/service/expiry.ts', /export interface ModelExpiry/, /}/)}

${SubSection(Links.Stream)}

Some implementations also allow for the ability to read/write binary data as a stream.  Given that all implementations can store ${lib.Base64} encoded data, the key differentiator here, is native support for streaming data, as well as being able to store binary data of significant sizes.  This pattern is currently used by ${mod.Asset} for reading and writing asset data.

${Snippet('Stream Contract', './src/service/stream.ts', /export interface ModelStream/, /}/)}

${SubSection(Links.Bulk)}

Finally, there is support for bulk operations.  This is not to simply imply issuing many commands at in parallel, but implementation support for an atomic/bulk operation.  This should allow for higher throughput on data ingest, and potentially for atomic support on transactions.  

${Snippet('Bulk Contract', './src/service/bulk.ts', /export interface ModelBulk/, /}/)}

${Section('Declaration')}
Models are declared via the ${Model} decorator, which allows the system to know that this is a class that is compatible with the module.  The only requirement for a model is the ${ModelTypeSnippet.link}

${ModelTypeSnippet}

All fields are optional, but the ${fld`id`} and ${fld`type`} are important as those field types are unable to be changed.  This may make using existing data models impossible if types other than strings are required.  Additionally, the type field, is intended to record the base model type and cannot be remapped. This is important to support polymorphism, not only in ${mod.Model}, but also in ${mod.Schema}.

${Section('Implementations')}

${Table(
  ['Service', 'Basic', 'CRUD', 'Indexed', 'Expiry', 'Stream', 'Bulk'],
  [mod.ModelDynamodb, 'X', 'X', 'X', 'X', ' ', ' '],
  [mod.ModelElasticsearch, 'X', 'X', 'X', ' ', ' ', 'X'],
  [mod.ModelFirestore, 'X', 'X', 'X', ' ', ' ', ' '],
  [mod.ModelMongo, 'X', 'X', 'X', ' ', 'X', 'X'],
  [mod.ModelRedis, 'X', 'X', 'X', 'X', ' ', ''],
  [mod.ModelS3, 'X', 'X', ' ', ' ', 'X', ' '],
  [mod.ModelSql, 'X', 'X', 'X', ' ', ' ', 'X'],
  [d`${MemoryModelService}`, 'X', 'X', 'X', 'X', 'X', 'X'],
  [d`${FileModelService}`, 'X', 'X', ' ', 'X', 'X', 'X']
)}

${Section('Custom Model Service')}
In addition to the provided contracts, the module also provides common utilities and shared test suites.  The common utilities are useful for
repetitive functionality, that is unable to be shared due to not relying upon inheritance (this was an intentional design decision).  This allows for all the ${mod.Model} implementations to completely own the functionality and also to be able to provide additional/unique functionality that goes beyond the interface.

${Code('Memory Service', './src/provider/memory.ts', true)}

To enforce that these contracts are honored, the module provides shared test suites to allow for custom implementations to ensure they are adhering to the contract's expected behavior.

${Code('Memory Service Test Configuration', './test/memory.ts')}
`;