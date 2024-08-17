import { ClassInstance } from '@travetto/runtime';
import type { ModelBulkSupport } from '../../service/bulk';
import { ModelCrudSupport } from '../../service/crud';
import type { ModelExpirySupport } from '../../service/expiry';
import { ModelIndexedSupport } from '../../service/indexed';
import type { ModelStorageSupport } from '../../service/storage';
import { ModelBlobSupport } from '../../service/blob';

export class ModelBasicSupportTarget { }
export class ModelCrudSupportTarget { }
export class ModelBulkSupportTarget { }
export class ModelStorageSupportTarget { }
export class ModelBlobSupportTarget { }
export class ModelExpirySupportTarget { }
export class ModelIndexedSupportTarget { }

/**
 * Type guard for determining if service supports basic operations
 * @param o
 */
export function isBasicSupported(o: ClassInstance): o is ModelBulkSupport {
  return !!o && 'create' in o;
}

/**
 * Type guard for determining if service supports crud operations
 * @param o
 */
export function isCrudSupported(o: ClassInstance): o is ModelCrudSupport {
  return !!o && 'upsert' in o;
}

/**
 * Type guard for determining if model supports expiry
 * @param o
 */
export function isExpirySupported(o: ClassInstance): o is ModelExpirySupport {
  return !!o && 'deleteExpired' in o;
}

/**
 * Type guard for determining if service supports streaming operation
 * @param o
 */
export function isBlobSupported(o: ClassInstance): o is ModelBlobSupport {
  return !!o && 'getBlob' in o;
}

/**
 * Type guard for determining if service supports storage operation
 * @param o
 */
export function isStorageSupported(o: ClassInstance): o is ModelStorageSupport {
  return !!o && 'createStorage' in o;
}

/**
 * Type guard for determining if service supports streaming operation
 * @param o
 */
export function isBulkSupported(o: ClassInstance): o is ModelBulkSupport {
  return !!o && 'processBulk' in o;
}

/**
 * Type guard for determining if service supports indexed operation
 * @param o
 */
export function isIndexedSupported(o: ClassInstance): o is ModelIndexedSupport {
  return !!o && 'getByIndex' in o;
}

