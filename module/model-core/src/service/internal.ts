import type { ModelBulkSupport } from './bulk';
import { ModelCrudSupport } from './crud';
import type { ModelExpirySupport } from './expire';
import type { ModelStorageSupport } from './storage';
import type { ModelStreamSupport } from './stream';

export class ModelCrudSupportTarget { }
export class ModelBulkSupportTarget { }
export class ModelStorageSupportTarget { }
export class ModelExpirySupportTarget { }
export class ModelStreamSupportTarget { }

/**
 * Type guard for determining if model is expirable
 * @param o
 */
export function isExpirySupported(o: ModelCrudSupport): o is ModelExpirySupport {
  return o && 'getExpiry' in o;
}

/**
 * Type guard for determining if service supports storage operation
 * @param o
 */
export function isStorageSupported(o: ModelCrudSupport): o is ModelStorageSupport {
  return o && 'createStorage' in o;
}

/**
 * Type guard for determining if service supports streaming operation
 * @param o
 */
export function isStreamSupported(o: ModelCrudSupport): o is ModelStreamSupport {
  return o && 'getStream' in o;
}

/**
 * Type guard for determining if service supports streaming operation
 * @param o
 */
export function isBulkSupported(o: ModelCrudSupport): o is ModelBulkSupport {
  return o && 'processBulk' in o;
}