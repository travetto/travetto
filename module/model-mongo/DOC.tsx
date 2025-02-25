/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { ModelQueryTypes } from '@travetto/model-query/support/doc.support';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support';

import { MongoModelConfig } from './src/config';
import { MongoModelService } from './src/service';

const RuntimeResources = d.codeLink('RuntimeResources', '@travetto/runtime/src/resources.ts', /RuntimeResources/);

export const text = <>
  <c.StdHeader />
  This module provides an {d.library('MongoDB')}-based implementation for the {d.mod('Model')}.  This source allows the {d.mod('Model')} module to read, write and query against {d.library('MongoDB')}.. Given the dynamic nature of {d.library('MongoDB')}, during development when models are modified, nothing needs to be done to adapt to the latest schema. <br />

  Supported features:
  <ul>
    {...ModelTypes(MongoModelService)}
    {...ModelQueryTypes(MongoModelService)}
  </ul>

  <ModelCustomConfig cfg={MongoModelConfig} />

  The SSL file options in {d.input('clientOptions')} will automatically be resolved to files when given a path.  This path can be a resource path (will attempt to lookup using {RuntimeResources}) or just a standard file path.
</>;