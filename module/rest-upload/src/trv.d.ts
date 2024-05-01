import '@travetto/rest';

declare global {
  interface TravettoRequest {
    files: Record<string, File>;
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