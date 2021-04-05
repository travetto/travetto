import { d, lib, mod } from '@travetto/doc';
import { ModelQueryTypes } from '@travetto/model-query/support/doc-support';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc-support';

import { MongoModelConfig } from './src/config';
import { MongoModelService } from './src/service';

const ResourceManager = d.SnippetLink('ResourceManager', '@travetto/base/src/resource.ts', /class [$]Resource/);

export const text = d`
${d.Header()}

This module provides an ${lib.MongoDB}-based implementation for the ${mod.Model}.  This source allows the ${mod.Model} module to read, write and query against ${lib.MongoDB}.. Given the dynamic nature of ${lib.MongoDB}, during development when models are modified, nothing needs to be done to adapt to the latest schema.

Supported featrues:
${d.List(
  ...ModelTypes(MongoModelService),
  ...ModelQueryTypes(MongoModelService)
)}

${ModelCustomConfig(MongoModelConfig)}

The SSL file options in ${d.Input('clientOptions')} will automatically be resolved to files when given a path.  This path can be a ${ResourceManager} path or just a standard file path.
`;