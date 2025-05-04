/**
 * Represents the authenticated token used, allows for reuse on subsequent calls
 * @concrete
 */
export interface AuthToken {
  value: string;
  type: string;
};
