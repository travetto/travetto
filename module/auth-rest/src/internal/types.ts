import { ParamExtractor } from '@travetto/rest';
import { AuthContext } from '@travetto/auth';
import { DependencyRegistry } from '@travetto/di';

import { AuthenticatorStateTarget, PrincipalTarget } from '@travetto/auth/src/internal/types';

export class PrincipalEncoderTarget { }

// Register context providers
ParamExtractor.registerContext(PrincipalTarget, () =>
  DependencyRegistry.getInstance(AuthContext).then(a => a.principal)
);

ParamExtractor.registerContext(AuthenticatorStateTarget, () =>
  DependencyRegistry.getInstance(AuthContext).then(a => a.AuthenticatorState)
);
