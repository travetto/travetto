/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support.ts';

import { FirestoreModelConfig } from './src/config.ts';
import { FirestoreModelService } from './src/service.ts';

export const text = <>
  <c.StdHeader />
  This module provides an {d.library('Firestore')}-based implementation of the {d.mod('Model')}.  This source allows the {d.mod('Model')} module to read, write and query against {d.library('Firestore')}. <br />

  Supported features:
  <ul>
    {...ModelTypes(FirestoreModelService)}
  </ul>

  <ModelCustomConfig cfg={FirestoreModelConfig} />
</>;