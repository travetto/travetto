const TRUE = new Set(['1', 'true']);

/**
 * Common values, used to influence runtime behavior
 */
export const Runtime = {
  /** Are we in development mode */
  get production(): boolean {
    return process.env.NODE_ENV === 'production';
  },

  /** Is the app in dynamic mode? */
  get dynamic(): boolean {
    return TRUE.has(process.env.TRV_DYNAMIC!);
  },
};