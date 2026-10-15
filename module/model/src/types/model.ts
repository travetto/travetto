/**
 * Model Id Generator function
 */
export type ModelIdGenerator = () => string;

/**
 * Simple model interface
 */
export type ModelType = {};

/**
 * Options for listing items
 */
export interface ModelListOptions {
  abort?: AbortSignal;
  limit?: number;
  batchSizeHint?: number;
}
