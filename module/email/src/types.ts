import { Readable } from 'stream';
import { Url } from 'url';

/**
 * An address
 */
interface Address {
  name: string;
  address: string;
}

/**
 * An attachment for the email
 */
interface AttachmentLike {
  content?: string | Buffer | Readable;
  path?: string | Url;
}

/**
 * A full attachment
 */
interface Attachment extends AttachmentLike {
  filename?: string | false;
  cid?: string;
  encoding?: string;
  contentType?: string;
  contentTransferEncoding?: string;
  contentDisposition?: string;
  headers?: Record<string, string | string[]>;
  raw?: string | Buffer | Readable | AttachmentLike;
}

/**
 * Full message options
 */
export interface MessageOptions {
  from?: string | Address;
  sender?: string | Address;
  to?: string | Address | (string | Address)[];
  cc?: string | Address | (string | Address)[];
  bcc?: string | Address | (string | Address)[];
  replyTo?: string | Address;
  inReplyTo?: string | Address;
  references?: string | string[];
  subject?: string;
  text?: string | Buffer | Readable | AttachmentLike;
  html?: string | Buffer | Readable | AttachmentLike;
  headers?: Record<string, string | string[]>;
  attachments?: Attachment[];
  alternatives?: Attachment[];
  messageId?: string;
  date?: Date | string;
  encoding?: string;
}

export type SentMessage = any;