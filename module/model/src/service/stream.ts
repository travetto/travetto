import * as stream from 'stream';

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
 * Support for Streams CRD.  Stream update is not supported.
 *
 * @concrete ../internal/service/common:ModelStreamSupportTarget
 */
export interface ModelStreamSupport {

  /**
   * Upsert stream to storage
   * @param location The location of the stream
   * @param input The actual stream to write
   * @param meta The stream metadata
   */
  upsertStream(location: string, input: stream.Readable, meta: StreamMeta): Promise<void>;

  /**
   * Get stream from asset store
   * @param location The location of the stream
   */
  getStream(location: string): Promise<stream.Readable>;

  /**
   * Get metadata for stream
   * @param location The location of the stream
   */
  describeStream(location: string): Promise<StreamMeta>;

  /**
   * Delete stream by location
   * @param location The location of the stream
   */
  deleteStream(location: string): Promise<void>;
}