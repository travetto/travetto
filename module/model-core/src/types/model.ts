/**
 * Simple model interface
 */
export interface ModelType {
  /**
   * Unique identifier.
   *
   * If not provided, will be computed on create
   */
  id?: string;
  /**
   * Type of model to save
   */
  type?: string;
  /**
   * Run before saving
   */
  prePersist?(): void | Promise<void>;
  /**
   * Run after loading
   */
  postLoad?(): void | Promise<void>;
}