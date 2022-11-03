import { d, lib, mod } from '@travetto/doc';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc.support';

import { FirestoreModelConfig } from '@travetto/model-firestore/src/config';
import { FirestoreModelService } from '@travetto/model-firestore/src/service';

export const text = d`
${d.Header()}

This module provides an ${lib.Firestore}-based implementation of the ${mod.Model}.  This source allows the ${mod.Model} module to read, write and query against ${lib.Firestore}.

Supported features:
${d.List(
  ...ModelTypes(FirestoreModelService)
)}

${ModelCustomConfig(FirestoreModelConfig)}
`;