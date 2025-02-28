/**
 * Model Id Source
 */
export type ModelIdSource = { create: () => string, valid: (id: string) => boolean };

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
  id: string;
}

export type OptionalId<T extends { id: string }> = Omit<T, 'id'> & { id?: string };