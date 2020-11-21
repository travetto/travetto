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
export interface ModelStreamSupport extends ModelCrudSupport {

  /**
   * Upsert stream to storage
   * @param id The identifier of the stream, not contrained to be a uuid
   * @param stream The actual stream to write
   * @param meta The stream metadata
   */
  upsertStream(id: string, stream: NodeJS.ReadableStream, meta: StreamMeta): Promise<void>;

  /**
   * Get stream from asset store
   * @param id The identifier of the stream
   */
  getStream(id: string): Promise<NodeJS.ReadableStream>;

  /**
   * Get metadata for stream
   * @param id The identifier of the stream
   */
  getStreamMetadata(id: string): Promise<StreamMeta>;

  /**
   * Delete stream by id
   * @param id The identifier of the stream
   */
  deleteStream(id: string): Promise<void>;
}