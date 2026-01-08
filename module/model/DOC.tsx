/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { toConcrete } from '@travetto/runtime';
import {
  type ModelBasicSupport, type ModelBlobSupport, type ModelBulkSupport, type ModelCrudSupport,
  type ModelExpirySupport, type ModelIndexedSupport, ModelRegistryIndex, type ModelType
} from '@travetto/model';

import { Model } from './src/registry/decorator.ts';
import { Links } from './support/doc.support.ts';

const ModelTypeContract = toConcrete<ModelType>();

const ModelImplementations = () => {
  const modelImplHeader = ['Service', 'Basic', 'CRUD', 'Indexed', 'Expiry', 'Blob', 'Bulk'].map(name => <td>{name}</td>);

  const modelImplRows = ([
    [d.mod('ModelDynamodb'), 'X', 'X', 'X', 'X', ' ', ' '],
    [d.mod('ModelElasticsearch'), 'X', 'X', 'X', 'X', ' ', 'X'],
    [d.mod('ModelFirestore'), 'X', 'X', 'X', ' ', ' ', ' '],
    [d.mod('ModelMongo'), 'X', 'X', 'X', 'X', 'X', 'X'],
    [d.mod('ModelRedis'), 'X', 'X', 'X', 'X', ' ', ''],
    [d.mod('ModelS3'), 'X', 'X', ' ', 'X', 'X', ' '],
    [d.mod('ModelSql'), 'X', 'X', 'X', 'X', ' ', 'X'],
    [d.mod('ModelMemory'), 'X', 'X', 'X', 'X', 'X', 'X'],
    [d.mod('ModelFile'), 'X', 'X', ' ', 'X', 'X', 'X']
  ] as const)
    .map(node => <tr>{...node.map(cell => <td>{cell}</td>)}</tr>);

  return <table>
    <thead><tr>{...modelImplHeader}</tr></thead>
    <tbody>{...modelImplRows}</tbody>
  </table>;
};

export const text = <>
  <c.StdHeader />
  This module provides a set of contracts/interfaces to data model persistence, modification and retrieval.  This module builds heavily upon the {d.mod('Schema')}, which is used for data model validation.

  <c.Section title='A Simple Model'>
    A model can be simply defined by usage of the {Model} decorator, which opts it into the {d.mod('Schema')} contracts, as well as making it available to the {ModelRegistryIndex}.

    <c.Code src='./doc-exec/src/sample.ts' title='Basic Structure' />

    Once the model is defined, it can be leveraged with any of the services that implement the various model storage contracts.  These contracts allow for persisting and fetching of the associated model object.
  </c.Section>

  <c.Section title='Contracts'>

    The module is mainly composed of contracts.  The contracts define the expected interface for various model patterns. The primary contracts are {Links.Basic}, {Links.Crud}, {Links.Indexed}, {Links.Expiry}, {Links.Blob} and {Links.Bulk}.

    <c.SubSection title='Basic'>
      All {d.mod('Model')} implementations, must honor the {Links.Basic} contract to be able to participate in the model ecosystem.  This contract represents the bare minimum for a model service.

      <c.Code src={toConcrete<ModelBasicSupport>()} title='Basic Contract' />
    </c.SubSection>

    <c.SubSection title='CRUD'>
      The {Links.Crud} contract, builds upon the basic contract, and is built around the idea of simple data retrieval and storage, to create a foundation for other services that need only basic support.  The model extension in {d.mod('Auth')}, is an example of a module that only needs create, read and delete, and so any implementation of {d.mod('Model')} that honors this contract, can be used with the {d.mod('Auth')} model extension.

      <c.Code src={toConcrete<ModelCrudSupport>()} title='Crud Contract' />
    </c.SubSection>

    <c.SubSection title='Indexed' >
      Additionally, an implementation may support the ability for basic {Links.Indexed} queries. This is not the full featured query support of {d.mod('ModelQuery')}, but allowing for indexed lookups.  This does not support listing by index, but may be added at a later date.

      <c.Code src={toConcrete<ModelIndexedSupport>()} title='Indexed Contract' />
    </c.SubSection>

    <c.SubSection title='Expiry'>
      Certain implementations will also provide support for automatic {Links.Expiry} of data at runtime.  This is extremely useful for temporary data as, and is used in the {d.mod('Cache')} module for expiring data accordingly.

      <c.Code src={toConcrete<ModelExpirySupport>()} title='Expiry Contract' />
    </c.SubSection>

    <c.SubSection title='Blob'>
      Some implementations also allow for the ability to read/write binary data as {Links.Blob}.  Given that all implementations can store {d.library('Base64')} encoded data, the key differentiator here, is native support for streaming data, as well as being able to store binary data of significant sizes.

      <c.Code src={toConcrete<ModelBlobSupport>()} title='Blob Contract' />
    </c.SubSection>
    <c.SubSection title='Bulk'>
      Finally, there is support for {Links.Bulk} operations.  This is not to simply imply issuing many commands at in parallel, but implementation support for an atomic/bulk operation.  This should allow for higher throughput on data ingest, and potentially for atomic support on transactions.

      <c.Code src={toConcrete<ModelBulkSupport>()} title='Bulk Contract' />
    </c.SubSection>
  </c.Section>

  <c.Section title='Declaration'>
    Models are declared via the {Model} decorator, which allows the system to know that this is a class that is compatible with the module.  The only requirement for a model is the {ModelTypeContract}

    <c.Code src={ModelTypeContract} />

    The {d.field('id')} is the only required field for a model, as this is a hard requirement on naming and type.  This may make using existing data models impossible if types other than strings are required.  Additionally, the {d.field('type')} field, is intended to record the base model type, but can be remapped. This is important to support polymorphism, not only in {d.mod('Model')}, but also in {d.mod('Schema')}.
  </c.Section>

  <c.Section title='Implementations'>
    <ModelImplementations />
  </c.Section>

  <c.Section title='Custom Model Service'>
    In addition to the provided contracts, the module also provides common utilities and shared test suites.  The common utilities are useful for repetitive functionality, that is unable to be shared due to not relying upon inheritance (this was an intentional design decision).  This allows for all the {d.mod('Model')} implementations to completely own the functionality and also to be able to provide additional/unique functionality that goes beyond the interface. {d.mod('ModelMemory')} serves as a great example of what a full featured implementation can look like.

    <br />

    To enforce that these contracts are honored, the module provides shared test suites to allow for custom implementations to ensure they are adhering to the contract's expected behavior.

    <c.Code title='Memory Service Test Configuration' src='./support/test/base.ts' />
  </c.Section>

  <c.Section title='CLI - model:export'>
    The module provides the ability to generate an export of the model structure from all the various {Model}s within the application.  This is useful for being able to generate the appropriate files to manually create the data schemas in production.

    <c.Execution title='Running model export' cmd='trv' args={['model:export', '--help']} config={{ workingDirectory: './doc-exec' }} />
  </c.Section>
  <c.Section title='CLI - model:install'>

    The module provides the ability to install all the various {Model}s within the application given the current configuration being targeted.  This is useful for being able to prepare the datastore manually.

    <c.Execution title='Running model install' cmd='trv' args={['model:install', '--help']} config={{ workingDirectory: './doc-exec' }} />
  </c.Section>
</>;