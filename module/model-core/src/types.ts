import { Class } from '@travetto/registry';

interface StreamMeta {
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

export interface ModelCore {
  /**
   * Get by Id
   * @param id The identifier of the document to retrieve
   */
  get<T extends { id: string }>(cls: Class<T>, id: string): Promise<T>;

  /**
   * Create new item
   * @param item The document to create
   */
  create(item: T): Promise<T>;

  /**
   * Update an item
   * @param item The document to update.
   */
  update(item: T): Promise<T>;

  /**
   * Delete an item
   * @param id The id of the document to delete
   */
  delete(id: string): Promise<void>;

  /**
   * List all items
   */
  list(): AsyncIterator<T>;

  /**
   * Write stream to asset store
   * @param id The identifier of the stream
   * @param stream The actual stream to write
   * @param meta The stream metadata
   */
  writeStream?(id: string, stream: NodeJS.ReadableStream, meta: StreamMeta): Promise<void>;

  /**
   * Get stream from asset store
   * @param id The identifier of the stream
   */
  readStream?(id: string): Promise<NodeJS.ReadableStream>;

  /**
   * Get info for stream
   * @param id The identifier of the stream
   */
  headStream?(id: string): Promise<StreamMeta>;

  /**
   * Set expiry time for a record of a given id
   *
   * @param id The identifier of the document
   * @param ttl Time to live in seconds
   */
  expires?(id: string, ttl: number): Promise<void>;

  /**
   * Determines if the associated document is expired
   *
   * @param id The identifier of the document
   */
  isExpired?(id: string): Promise<boolean>;
}