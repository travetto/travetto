/** @jsxImportSource @travetto/doc/support */
import { c, d } from '@travetto/doc';

import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support.ts';
import { ModelIndexedTypes } from '@travetto/model-indexed/support/doc.support.ts';
import { ModelQueryTypes } from '@travetto/model-query/support/doc.support.ts';

import { MysqlModelConfig } from './src/config.ts';
import { MysqlModelService } from './src/service.ts';

export const text = (
  <>
    <c.StdHeader />
    This module provides a {d.library('MySQL')}-based implementation for the {d.module('Model')} module. This source allows the{' '}
    {d.module('Model')} module to read, write and query against {d.library('SQL')} databases. In development mode, the {MysqlModelService}{' '}
    will also modify the database schema in real time to minimize impact to development. <br />
    The schema generated will not generally map to existing tables as it is attempting to produce a document store like experience on top of
    a {d.library('SQL')} database. Every table generated maps to a model, with simple fields mapped as individual columns and complex fields/arrays mapped as native {d.input('JSON')} columns. <br />
    Supported features:
    <ul>
      {...ModelTypes(MysqlModelService)}
      {...ModelIndexedTypes(MysqlModelService)}
      {...ModelQueryTypes(MysqlModelService)}
    </ul>
    <ModelCustomConfig config={MysqlModelConfig} />
  </>
);
