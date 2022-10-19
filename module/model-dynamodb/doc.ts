import { d, lib, mod } from '@travetto/doc';

import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support';

import { DynamoDBModelService } from './src/service';
import { DynamoDBModelConfig } from './src/config';

export const text = d`
${d.Header()}

This module provides an ${lib.DynamoDB}-based implementation for the ${mod.Model}.  This source allows the ${mod.Model} module to read, write and query against ${lib.DynamoDB}. The entire document is stored as a single value, so nothing is needed to handle schema updates in real time. Indices on the other hand are more complicated, and will not be retroactively computed for new values.

Supported features:
${d.List(
  ...ModelTypes(DynamoDBModelService)
)}

${ModelCustomConfig(DynamoDBModelConfig)}
`;