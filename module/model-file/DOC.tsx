/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { FileModelService } from '@travetto/model-file';
import { ModelIndexedTypes } from '@travetto/model-indexed/support/doc.support.ts';
import { ModelTypes } from '@travetto/model/support/doc.support.ts';

export const text = <>
  <c.StdHeader />
  This module provides an file-based implementation for the {d.module('Model')}.

  Supported features:
  <ul>
    {...ModelTypes(FileModelService)}
    {...ModelIndexedTypes(FileModelService)}
  </ul>

</>;