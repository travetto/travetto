import type { ModelBulkSupport } from '../../service/bulk';
import { ModelCrudSupport } from '../../service/crud';
import type { ModelExpirySupport } from '../../service/expiry';
import { ModelIndexedSupport } from '../../service/indexed';
import type { ModelStorageSupport } from '../../service/storage';
import type { ModelStreamSupport } from '../../service/stream';

export class ModelBasicSupportTarget { }
export class ModelCrudSupportTarget { }
export class ModelBulkSupportTarget { }
export class ModelStorageSupportTarget { }
export class ModelExpirySupportTarget { }
export class ModelStreamSupportTarget { }
export class ModelIndexedSupportTarget { }

/**
 * Type guard for determining if service supports basic operations
 * @param o
 */
export function isBasicSupported(o: any): o is ModelBulkSupport {
  return o && 'create' in o;
}


/**
 * Type guard for determining if service supports crud operations
 * @param o
 */
export function isCrudSupported(o: any): o is ModelCrudSupport {
  return o && 'upsert' in o;
}

/**
 * Type guard for determining if model is expirable
 * @param o
 */
export function isExpirySupported(o: any): o is ModelExpirySupport {
  return o && 'getExpiry' in o;
}

/**
 * Type guard for determining if service supports storage operation
 * @param o
 */
export function isStorageSupported(o: any): o is ModelStorageSupport {
  return o && 'createStorage' in o;
}

/**
 * Type guard for determining if service supports streaming operation
 * @param o
 */
export function isStreamSupported(o: any): o is ModelStreamSupport {
  return o && 'getStream' in o;
}

/**
 * Type guard for determining if service supports streaming operation
 * @param o
 */
export function isBulkSupported(o: any): o is ModelBulkSupport {
  return o && 'processBulk' in o;
}

/**
 * Type guard for determining if service supports indexed operation
 * @param o
 */
export function isIndexedSupported(o: any): o is ModelIndexedSupport {
  return o && 'getByIndex' in o;
}

