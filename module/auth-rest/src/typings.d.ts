import { Principal } from '@travetto/auth';

declare global {
  export interface TravettoRequest {
    /**
     * The authenticated principal
     */
    auth?: Principal;
  }
}