/**
 * Definition for an work set
 */
export interface WorkSet<X> {
  /**
   * Determines if there is more work to do
   */
  hasNext(): boolean | Promise<boolean>;
  /**
   * Get next item
   */
  next(): X | Promise<X>;
}