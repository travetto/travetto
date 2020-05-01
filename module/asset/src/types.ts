/**
 * A retrieval/storable asset
 *
 * @concrete ./internal/types:AssetImpl
 */
export interface Asset {
  /**
   * Stream of the asset contents
   */
  stream: NodeJS.ReadableStream;
  /**
   * Size in bytes
   */
  size: number;
  /**
   * Path within the remote store
   */
  path: string;
  /**
   * Mime type of the content
   */
  contentType: string;
  /**
   * Supplemental information
   */
  metadata: {
    /**
     * The filename of the asset
     */
    name: string;
    /**
     * A readable title of the asset
     */
    title: string;
    /**
     * Hash of the file contents.  Different files with the same name, will have the same hash
     */
    hash: string;
    /**
     * Date of creation
     */
    createdDate: Date;
    /**
     * Optional tags, can be used for access control
     */
    tags?: string[];
  };
}

