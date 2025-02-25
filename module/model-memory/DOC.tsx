/** @jsxImportSource @travetto/doc */
import { d, c } from '@travetto/doc';
import { MemoryModelService } from '@travetto/model-memory';
import { ModelQueryTypes } from '@travetto/model-query/support/doc.support';
import { ModelTypes } from '@travetto/model/support/doc.support';

export const text = <>
  <c.StdHeader />
  This module provides a memory-based implementation for the {d.mod('Model')}.

  Supported features:
  <ul>
    {...ModelTypes(MemoryModelService)}
    {...ModelQueryTypes(MemoryModelService)}
  </ul>
</>;