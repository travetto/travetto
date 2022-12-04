import { d, lib, mod } from '@travetto/doc';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support';

import { RedisModelConfig } from '@travetto/model-redis/src/config';
import { RedisModelService } from '@travetto/model-redis/src/service';

export const text = () => d`
${d.Header()}

This module provides an ${lib.Redis}-based implementation for the ${mod.Model}.  This source allows the ${mod.Model} module to read, write and query against ${lib.Redis}.

Supported features:
${d.List(
  ...ModelTypes(RedisModelService)
)}

${ModelCustomConfig(RedisModelConfig)}
`;