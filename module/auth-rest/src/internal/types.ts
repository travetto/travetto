import { ParamExtractor } from '@travetto/rest';
import { PrincipalTarget } from '@travetto/auth/src/internal/types';

export class PrincipalCodecTarget { }

ParamExtractor.registerContext(PrincipalTarget, (_, req) => req.user);