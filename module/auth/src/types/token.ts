/**
 * Represents the authenticated token used, allows for reuse on subsequent calls
 */
export interface AuthToken {
  value: string;
  type: string;
};
