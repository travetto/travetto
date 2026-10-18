/**
 * Model identifier type
 */
export type ModelId = string;

/**
 * Simple model interface
 * @concrete
 */
export interface ModelType {
  /**
   * Unique identifier.
   *
   * If not provided, will be computed on create
   */
  id: ModelId;
}

export type OptionalId<T extends ModelType> = Omit<T, 'id'> & { id?: ModelId };
export type PartialWithId<T extends ModelType> = Partial<T> & Pick<T, 'id'>;

/**
 * Options for listing items
 */
export interface ModelListOptions {
  abort?: AbortSignal;
  limit?: number;
  batchSizeHint?: number;
}
