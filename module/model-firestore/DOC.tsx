/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support';

import { FirestoreModelConfig } from './src/config';
import { FirestoreModelService } from './src/service';

export const text = <>
  <c.StdHeader />
  This module provides an {d.library('Firestore')}-based implementation of the {d.mod('Model')}.  This source allows the {d.mod('Model')} module to read, write and query against {d.library('Firestore')}. <br />

  Supported features:
  <ul>
    {...ModelTypes(FirestoreModelService)}
  </ul>

  <ModelCustomConfig cfg={FirestoreModelConfig} />
</>;