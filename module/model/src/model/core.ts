/**
 * Base model contract
 */
export interface ModelCore {
  /**
   * Identifier, can be provided
   */
  id?: string;
  /**
   * Tyep of model to save
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