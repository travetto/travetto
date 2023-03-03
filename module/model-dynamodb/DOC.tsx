/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';

import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support';

import { DynamoDBModelService } from './src/service';
import { DynamoDBModelConfig } from './src/config';

export const text = <>
  <c.StdHeader />
  This module provides an {d.library('DynamoDB')}-based implementation for the {d.mod('Model')}.  This source allows the {d.mod('Model')} module to read, write and query against {d.library('DynamoDB')}. The entire document is stored as a single value, so nothing is needed to handle schema updates in real time. Indices on the other hand are more complicated, and will not be retroactively computed for new values. <br />

  Supported features:
  <ul>
    {...ModelTypes(DynamoDBModelService)}
  </ul>

  <ModelCustomConfig cfg={DynamoDBModelConfig} />
</>;