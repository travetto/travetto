/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

import { FileModelService } from './src/provider/file';
import { MemoryModelService } from './src/provider/memory';
import { Model } from './src/registry/decorator';
import { Links } from './support/doc.support';

const ModelTypeSnippet = <c.Code title='ModelType' src='src/types/model.ts' startRe={/export interface/} endRe={/^}/} />;

const ModelImplementations = () => {
  const modelImplHeader = ['Service', 'Basic', 'CRUD', 'Indexed', 'Expiry', 'Stream', 'Bulk'].map(v => <td>{v}</td>);

  const modelImplRows = ([
    [d.mod('ModelDynamodb'), 'X', 'X', 'X', 'X', ' ', ' '],
    [d.mod('ModelElasticsearch'), 'X', 'X', 'X', 'X', ' ', 'X'],
    [d.mod('ModelFirestore'), 'X', 'X', 'X', ' ', ' ', ' '],
    [d.mod('ModelMongo'), 'X', 'X', 'X', 'X', 'X', 'X'],
    [d.mod('ModelRedis'), 'X', 'X', 'X', 'X', ' ', ''],
    [d.mod('ModelS3'), 'X', 'X', ' ', 'X', 'X', ' '],
    [d.mod('ModelSql'), 'X', 'X', 'X', 'X', ' ', 'X'],
    [MemoryModelService, 'X', 'X', 'X', 'X', 'X', 'X'],
    [FileModelService, 'X', 'X', ' ', 'X', 'X', 'X']
  ] as const)
    .map(r => <tr>{...r.map(cell => <td>{cell}</td>)}</tr>);

  return <table>
    <thead><tr>{...modelImplHeader}</tr></thead>
    <tbody>{...modelImplRows}</tbody>
  </table>;
};

export const text = <>
  <c.StdHeader />
  This module provides a set of contracts/interfaces to data model persistence, modification and retrieval.  This module builds heavily upon the {d.mod('Schema')}, which is used for data model validation.

  <c.Section title='Contracts'>

    The module is mainly composed of contracts.  The contracts define the expected interface for various model patterns. The primary contracts are {Links.Basic}, {Links.Crud}, {Links.Indexed}, {Links.Expiry}, {Links.Stream} and {Links.Bulk}.

    <c.SubSection title='Basic'>
      All {d.mod('Model')} implementations, must honor the {Links.Basic} contract to be able to participate in the model ecosystem.  This contract represents the bare minimum for a model service.

      <c.Code title='Basic Contract' src='src/service/basic.ts' startRe={/export interface ModelBasic/} endRe={/^}/} />
    </c.SubSection>

    <c.SubSection title='CRUD'>
      The {Links.Crud} contract, builds upon the basic contract, and is built around the idea of simple data retrieval and storage, to create a foundation for other services that need only basic support.  The model extension in {d.mod('Auth')}, is an example of a module that only needs create, read and delete, and so any implementation of {d.mod('Model')} that honors this contract, can be used with the {d.mod('Auth')} model extension.

      <c.Code title='Crud Contract' src='src/service/crud.ts' startRe={/export interface ModelCrud/} endRe={/^}/} />
    </c.SubSection>

    <c.SubSection title='Indexed' >
      Additionally, an implementation may support the ability for basic {Links.Indexed} queries. This is not the full featured query support of {d.mod('ModelQuery')}, but allowing for indexed lookups.  This does not support listing by index, but may be added at a later date.

      <c.Code title='Indexed Contract' src='src/service/indexed.ts' startRe={/export interface ModelIndexed/} endRe={/^}/} />
    </c.SubSection>

    <c.SubSection title='Expiry'>
      Certain implementations will also provide support for automatic {Links.Expiry} of data at runtime.  This is extremely useful for temporary data as, and is used in the {d.mod('Cache')} module for expiring data accordingly.

      <c.Code title='Expiry Contract' src='src/service/expiry.ts' startRe={/export interface ModelExpiry/} endRe={/^}/} />
    </c.SubSection>

    <c.SubSection title='Stream'>
      Some implementations also allow for the ability to read/write binary data as a {Links.Stream}.  Given that all implementations can store {d.library('Base64')} encoded data, the key differentiator here, is native support for streaming data, as well as being able to store binary data of significant sizes.  This pattern is currently used by {d.mod('Asset')} for reading and writing asset data.

      <c.Code title='Stream Contract' src='src/service/stream.ts' startRe={/export interface ModelStream/} endRe={/^}/} />
    </c.SubSection>
    <c.SubSection title='Bulk'>
      Finally, there is support for {Links.Bulk} operations.  This is not to simply imply issuing many commands at in parallel, but implementation support for an atomic/bulk operation.  This should allow for higher throughput on data ingest, and potentially for atomic support on transactions.

      <c.Code title='Bulk Contract' src='src/service/bulk.ts' startRe={/export interface ModelBulk/} endRe={/^}/} />
    </c.SubSection>
  </c.Section>

  <c.Section title='Declaration'>
    Models are declared via the {Model} decorator, which allows the system to know that this is a class that is compatible with the module.  The only requirement for a model is the {d.codeLink(ModelTypeSnippet)}

    {ModelTypeSnippet}

    All fields are optional, but the {d.field('id')} and {d.field('type')} are important as those field types are unable to be changed.  This may make using existing data models impossible if types other than strings are required.  Additionally, the type field, is intended to record the base model type and cannot be remapped. This is important to support polymorphism, not only in {d.mod('Model')}, but also in {d.mod('Schema')}.
  </c.Section>
  <c.Section title='Implementations'>
    <ModelImplementations />
  </c.Section>

  <c.Section title='Custom Model Service'>
    In addition to the provided contracts, the module also provides common utilities and shared test suites.  The common utilities are useful for
    repetitive functionality, that is unable to be shared due to not relying upon inheritance (this was an intentional design decision).  This allows for all the {d.mod('Model')} implementations to completely own the functionality and also to be able to provide additional/unique functionality that goes beyond the interface.

    <c.Code title='Memory Service' src='src/provider/memory.ts' outline={true} />

    To enforce that these contracts are honored, the module provides shared test suites to allow for custom implementations to ensure they are adhering to the contract's expected behavior.

    <c.Code title='Memory Service Test Configuration' src='./test/memory.ts' />
  </c.Section>

  <c.Section title='CLI - model:export'>
    The module provides the ability to generate an export of the model structure from all the various {Model}s within the application.  This is useful for being able to generate the appropriate files to manually create the data schemas in production.

    <c.Execution title='Running model export' cmd='trv' args={['model:export', '--help']} />
  </c.Section>
  <c.Section title='CLI - model:install'>

    The module provides the ability to install all the various {Model}s within the application given the current configuration being targeted.  This is useful for being able to prepare the datastore manually.

    <c.Execution title='Running model install' cmd='trv' args={['model:install', '--help']} />
  </c.Section>
</>;