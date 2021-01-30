import { doc as d, lib, mod, Code, List } from '@travetto/doc';
import { ModelCustomConfig, ModelTypes } from '@travetto/model/support/doc-support';

import { FirestoreModelConfig } from './src/config';
import { FirestoreModelService } from './src/service';

exports.text = d`
This module provides an ${lib.Firestore}-based implementation of the ${mod.Model}.  This source allows the ${mod.Model} module to read, write and query against ${lib.Firestore}.

Supported featrues:
${List(
  ...ModelTypes(FirestoreModelService)
)}

${ModelCustomConfig(FirestoreModelConfig)}
`;