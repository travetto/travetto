/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { ModelQueryTypes } from '@travetto/model-query/support/doc.support.ts';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support.ts';

import { ElasticsearchModelConfig } from './src/config.ts';
import { ElasticsearchModelService } from './src/service.ts';

export const text = <>
  <c.StdHeader />
  This module provides an {d.library('Elasticsearch')}-based implementation of the {d.mod('Model')}.  This source allows the {d.mod('Model')} module to read, write and query against {d.library('Elasticsearch')}. In development mode, {ElasticsearchModelService} will also modify the {d.library('Elasticsearch')} schema in real time to minimize impact to development. <br />

  Supported features:
  <ul>
    {...ModelTypes(ElasticsearchModelService)}
    {...ModelQueryTypes(ElasticsearchModelService)}
  </ul>

  <ModelCustomConfig cfg={ElasticsearchModelConfig} />
</>;