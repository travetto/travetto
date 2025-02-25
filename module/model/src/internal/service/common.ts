import { hasFunction } from '@travetto/runtime';

import type { ModelBulkSupport } from '../../service/bulk.ts';
import type { ModelCrudSupport } from '../../service/crud.ts';
import type { ModelExpirySupport } from '../../service/expiry.ts';
import type { ModelIndexedSupport } from '../../service/indexed.ts';
import type { ModelStorageSupport } from '../../service/storage.ts';
import type { ModelBlobSupport } from '../../service/blob.ts';

export class ModelBasicSupportTarget { }
export class ModelCrudSupportTarget { }
export class ModelBulkSupportTarget { }
export class ModelStorageSupportTarget { }
export class ModelBlobSupportTarget { }
export class ModelExpirySupportTarget { }
export class ModelIndexedSupportTarget { }

/**
 * Type guard for determining if service supports basic operations
 */
export const isBasicSupported = hasFunction<ModelBulkSupport>('create');

/**
 * Type guard for determining if service supports crud operations
 */
export const isCrudSupported = hasFunction<ModelCrudSupport>('upsert');

/**
 * Type guard for determining if model supports expiry
 */
export const isExpirySupported = hasFunction<ModelExpirySupport>('deleteExpired');

/**
 * Type guard for determining if service supports blob operations
 */
export const isBlobSupported = hasFunction<ModelBlobSupport>('getBlob');

/**
 * Type guard for determining if service supports storage operation
 */
export const isStorageSupported = hasFunction<ModelStorageSupport>('createStorage');

/**
 * Type guard for determining if service supports bulk operation
 */
export const isBulkSupported = hasFunction<ModelBulkSupport>('processBulk');

/**
 * Type guard for determining if service supports indexed operation
 */
export const isIndexedSupported = hasFunction<ModelIndexedSupport>('getByIndex');
