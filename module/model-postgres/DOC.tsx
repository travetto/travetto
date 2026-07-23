/** @jsxImportSource @travetto/doc/support */
import { c, d } from '@travetto/doc';
import { BaseSQLModelService } from '@travetto/model-sql';

import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support.ts';
import { ModelIndexedTypes } from '@travetto/model-indexed/support/doc.support.ts';
import { ModelQueryTypes } from '@travetto/model-query/support/doc.support.ts';

import { PostgresModelConfig } from './src/config.ts';
import { PostgresModelService } from './src/service.ts';

export const text = (
  <>
    <c.StdHeader />
    This module provides a {d.library('Postgres')}-based implementation for the {d.module('Model')} module. This source allows the{' '}
    {d.module('Model')} module to read, write and query against {d.library('SQL')} databases. In development mode, the{' '}
    {PostgresModelService} will also modify the database schema in real time to minimize impact to development. <br />
    The schema generated will not generally map to existing tables as it is attempting to produce a document store like experience on top of
    a {d.library('SQL')} database. Every table generated maps to a model:
    <ul>
      <li>
        Simple scalar fields map directly to individual native PostgreSQL columns (e.g., {d.input('VARCHAR')}, {d.input('INTEGER')},{' '}
        {d.input('TIMESTAMP')}).
      </li>
      <li>
        Simple scalar arrays (such as {d.input('string[]')}, {d.input('number[]')}, or {d.input('boolean[]')}) map directly to PostgreSQL
        native array columns (e.g., {d.input('VARCHAR[]')}, {d.input('INTEGER[]')}).
      </li>
      <li>Complex fields and arrays of sub-schema objects map to native {d.input('JSONB')} columns.</li>
    </ul>
    Supported features:
    <ul>
      {...ModelTypes(BaseSQLModelService)}
      {...ModelIndexedTypes(BaseSQLModelService)}
      {...ModelQueryTypes(BaseSQLModelService)}
    </ul>
    <ModelCustomConfig config={PostgresModelConfig} />
  </>
);
