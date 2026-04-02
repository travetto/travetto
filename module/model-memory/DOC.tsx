/** @jsxImportSource @travetto/doc/support */
import { d, c } from '@travetto/doc';
import { MemoryModelService } from '@travetto/model-memory';
import { ModelIndexedTypes } from '@travetto/model-indexed/support/doc.support.ts';
import { ModelTypes } from '@travetto/model/support/doc.support.ts';

export const text = <>
  <c.StdHeader />
  This module provides a memory-based implementation for the {d.module('Model')}.

  Supported features:
  <ul>
    {...ModelTypes(MemoryModelService)}
    {...ModelIndexedTypes(MemoryModelService)}
  </ul>
</>;