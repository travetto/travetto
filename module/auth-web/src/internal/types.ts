import { ParamExtractor } from '@travetto/web';
import { toConcrete } from '@travetto/runtime';
import { Principal } from '@travetto/auth';

// Register context providers
ParamExtractor.registerContext(toConcrete<Principal>(), (c, req) => req.user);