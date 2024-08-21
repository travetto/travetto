/**
 * Range of bytes, inclusive
 */
export type ByteRange = { start: number, end?: number };

export interface BlobMeta {
  /** Size of blob */
  size?: number;
  /** Mime type of the content */
  contentType?: string;
  /** Hash of blob contents */
  hash?: string;
  /** The original base filename of the file */
  filename?: string;
  /** Filenames title, optional for elements like images, audio, videos */
  title?: string;
  /** Content encoding */
  contentEncoding?: string;
  /** Content language */
  contentLanguage?: string;
  /** Cache control */
  cacheControl?: string;
  /** Byte range for blob */
  range?: Required<ByteRange>;
}