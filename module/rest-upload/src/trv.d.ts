import '@travetto/rest';

declare global {
  interface TravettoRequest {
    uploads: Record<string, Blob>;
  }

  /**
   * @concrete node:buffer#Blob
   */
  interface Blob { }

  /**
   * @concrete node:buffer#File
   */
  interface File { }
}