import { ParamExtractor } from '@travetto/rest';
import { toConcrete } from '@travetto/runtime';
import { Principal } from '@travetto/auth';

// Register context providers
ParamExtractor.registerContext(toConcrete<Principal>(), (c, req) => req.user);