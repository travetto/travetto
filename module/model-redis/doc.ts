import { doc as d, lib, mod, Code, List } from '@travetto/doc';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc-support';
import { RedisModelConfig } from './src/config';
import { RedisModelService } from './src/service';

exports.text = d`
This module provides an ${lib.Redis}-based implementation for the ${mod.Model}.  This source allows the ${mod.Model} module to read, write and query against ${lib.Redis}.

Supported featrues:
${List(
  ...ModelTypes(RedisModelService)
)}

${ModelCustomConfig(RedisModelConfig)}
`;