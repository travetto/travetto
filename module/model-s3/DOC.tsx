/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support.ts';

import { S3ModelConfig } from './src/config.ts';
import { S3ModelService } from './src/service.ts';

export const text = <>
  <c.StdHeader />
  This module provides an {d.library('S3')}-based implementation for the {d.mod('Model')}.  This source allows the {d.mod('Model')} module to read, write and stream against {d.library('S3')}. <br />

  Supported features:
  <ul>
    {...ModelTypes(S3ModelService)}
  </ul>

  <ModelCustomConfig config={S3ModelConfig} />

  <c.Note>
    Do not commit your {d.input('accessKeyId')} or {d.input('secretAccessKey')} values to your source repository, especially if it is public facing.  Not only is it a security risk, but Amazon will scan public repos, looking for keys, and if found will react swiftly.
  </c.Note>
</>;