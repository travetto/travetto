/**
 * Represents the authenticated token used, allows for reuse on subsequent calls
 * @concrete
 * @web_contextual
 */
export interface AuthToken {
  value: string;
  type: string;
};
