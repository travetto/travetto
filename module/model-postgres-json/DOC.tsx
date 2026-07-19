/** @jsxImportSource @travetto/doc/support */
import { c, d } from '@travetto/doc';

import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support.ts';
import { ModelIndexedTypes } from '@travetto/model-indexed/support/doc.support.ts';

import { PostgresJsonModelConfig } from './src/config.ts';
import { PostgresJsonModelService } from './src/service.ts';
import { ModelQueryTypes } from '@travetto/model-query/support/doc.support.tsx';

export const text = (
  <>
    <c.StdHeader />
    This module provides a {d.library('Postgres')}-based JSON document-store implementation of the {d.module('Model')}. This service allows
    the {d.module('Model')} module to read, write, index, and query against PostgreSQL using native JSONB columns. <br />
    Supported features:
    <ul>
      {...ModelTypes(PostgresJsonModelService)}
      {...ModelIndexedTypes(PostgresJsonModelService)}
      {...ModelQueryTypes(PostgresJsonModelService)}
    </ul>
    <ModelCustomConfig config={PostgresJsonModelConfig} />
  </>
);
