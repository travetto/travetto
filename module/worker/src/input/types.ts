/**
 * Definition for an input source
 */
export interface InputSource<X> {
  /**
   * Determines if there is more work to do
   */
  hasNext(): boolean | Promise<boolean>;
  /**
   * Get next item
   */
  next(): X | Promise<X>;
}