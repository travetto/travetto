import { ParamExtractor } from '@travetto/rest';

import { PrincipalTarget } from '@travetto/auth/src/internal/types';

export class PrincipalEncoderTarget { }

// Register context providers
ParamExtractor.registerContext(PrincipalTarget, (c, req) => req.user);