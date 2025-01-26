import { Principal } from '@travetto/auth';
import { RestCodec } from '@travetto/rest';

/**
 * Rest codec for reading/writing principal
 * @concrete ./internal/types#PrincipalCodecTarget
 */
export interface PrincipalCodec extends RestCodec<Principal> { }