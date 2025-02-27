import { hasFunction } from '@travetto/runtime';

import type { ModelBulkSupport } from '../../service/bulk';
import type { ModelCrudSupport } from '../../service/crud';
import type { ModelExpirySupport } from '../../service/expiry';
import type { ModelIndexedSupport } from '../../service/indexed';
import type { ModelStorageSupport } from '../../service/storage';
import type { ModelBlobSupport } from '../../service/blob';

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
