import { ParamExtractor } from '@travetto/rest';
import { asConcrete } from '@travetto/runtime';
import { Principal } from '@travetto/auth';

// Register context providers
ParamExtractor.registerContext(asConcrete<Principal>(), (c, req) => req.user);