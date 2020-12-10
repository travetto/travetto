import { ModelCrudSupport } from './crud';

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
  /**
   * The original filename of the file
   */
  filename: string;
}

/**
 * Support for NodeJS Streams CRD.  Stream update is not supported.
 *
 * @concrete ../internal/service/common:ModelStreamSupportTarget
 */
export interface ModelStreamSupport {

  /**
   * Upsert stream to storage
   * @param location The location of the stream
   * @param stream The actual stream to write
   * @param meta The stream metadata
   */
  upsertStream(location: string, stream: NodeJS.ReadableStream, meta: StreamMeta): Promise<void>;

  /**
   * Get stream from asset store
   * @param location The location of the stream
   */
  getStream(location: string): Promise<NodeJS.ReadableStream>;

  /**
   * Get metadata for stream
   * @param location The location of the stream
   */
  getStreamMetadata(location: string): Promise<StreamMeta>;

  /**
   * Delete stream by location
   * @param location The location of the stream
   */
  deleteStream(location: string): Promise<void>;
}