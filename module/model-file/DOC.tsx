/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { FileModelService } from '@travetto/model-file';
import { ModelQueryTypes } from '@travetto/model-query/support/doc.support.ts';
import { ModelTypes } from '@travetto/model/support/doc.support.ts';

export const text = <>
  <c.StdHeader />
  This module provides an file-based implementation for the {d.mod('Model')}.

  Supported features:
  <ul>
    {...ModelTypes(FileModelService)}
    {...ModelQueryTypes(FileModelService)}
  </ul>

</>;