import { Readable } from 'node:stream';

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
   * The original base filename of the file
   */
  filename: string;
  /**
   * Filenames title, optional for elements like images, audio, videos
   */
  title?: string;
  /**
   * Content encoding
   */
  contentEncoding?: string;
  /**
   * Content language
   */
  contentLanguage?: string;
  /**
   * Cache control
   */
  cacheControl?: string;
}

export interface PartialStream {
  stream: Readable;
  range: [start: number, end: number];
}

/**
 * A stream response
 */
export interface StreamResponse extends StreamMeta {
  stream(): Readable;
  /**
   * Response byte range, inclusive
   */
  range?: [start: number, end: number];
}

/**
 * Support for Streams CRD.  Stream update is not supported.
 *
 * @concrete ../internal/service/common#ModelStreamSupportTarget
 */
export interface ModelStreamSupport {

  /**
   * Upsert stream to storage
   * @param location The location of the stream
   * @param input The actual stream to write
   * @param meta The stream metadata
   */
  upsertStream(location: string, input: Readable, meta: StreamMeta): Promise<void>;

  /**
   * Get stream from asset store
   * @param location The location of the stream
   */
  getStream(location: string, start?: number, end?: number): Promise<Readable>;

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