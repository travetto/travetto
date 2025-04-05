/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support';

import { RedisModelConfig } from './src/config.ts';
import { RedisModelService } from './src/service.ts';

export const text = <>
  <c.StdHeader />
  This module provides an {d.library('Redis')}-based implementation for the {d.mod('Model')}.  This source allows the {d.mod('Model')} module to read, write and query against {d.library('Redis')}. <br />

  Supported features:
  <ul>
    {...ModelTypes(RedisModelService)}
  </ul>

  <ModelCustomConfig cfg={RedisModelConfig} />
</>;