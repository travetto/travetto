import { Principal } from '@travetto/auth';

declare global {
  export interface TravettoRequest {
    /**
     * The auth context
     */
    auth?: Principal;
  }
}