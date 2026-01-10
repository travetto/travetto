/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { SQLModelConfig, SQLModelService } from '@travetto/model-sql';

import { ModelQueryTypes } from '@travetto/model-query/support/doc.support.ts';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support.ts';

export const text = <>
  <c.StdHeader />
  This module provides a {d.library('Postgres')}-based implementation for the {d.module('Model')} module.  This source allows the {d.module('Model')} module to read, write and query against {d.library('SQL')} databases. In development mode, the {SQLModelService} will also modify the database schema in real time to minimize impact to development. <br />

  The schema generated will not generally map to existing tables as it is attempting to produce a document store like experience on top of
  a {d.library('SQL')} database.  Every table generated will have a {d.input('path_id')} which determines it's location in the document hierarchy as well as sub tables will have a {d.input('parent_path_id')} to associate records with the parent values. <br />

  Supported features:
  <ul>
    {...ModelTypes(SQLModelService)}
    {...ModelQueryTypes(SQLModelService)}
  </ul>

  <ModelCustomConfig config={SQLModelConfig} />
</>;