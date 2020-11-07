import { ModelCore } from './core';

export interface StreamMeta {
  /**
   * File size
   */
  size: number;
  /**
   * Mime type of the content
   */
  contentType: string;
  /**
   * Hash of the file contents.  Different files with the same name, will have the same hash
   */
  hash: string;
}

/**
 * Support for NodeJS Streams CRD.  Stream update is not supported.
 */
export interface ModelStreamable extends ModelCore {

  /**
   * Write stream to asset store
   * @param id The identifier of the stream
   * @param stream The actual stream to write
   * @param meta The stream metadata
   */
  writeStream(id: string, stream: NodeJS.ReadableStream, meta: StreamMeta): Promise<void>;

  /**
   * Get stream from asset store
   * @param id The identifier of the stream
   */
  readStream(id: string): Promise<NodeJS.ReadableStream>;

  /**
   * Get info for stream
   * @param id The identifier of the stream
   */
  headStream(id: string): Promise<StreamMeta>;

  /**
   * Get info for stream
   * @param id The identifier of the stream
   */
  deleteStream(id: string): Promise<boolean>;
}