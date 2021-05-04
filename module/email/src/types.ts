import { Url } from 'url';

/**
 * An address
 */
export interface Address {
  name: string;
  address: string;
}

/**
 * An attachment for the email
 */
interface AttachmentLike {
  content?: string | Buffer | NodeJS.ReadableStream;
  path?: string | Url;
}

/**
 * A full attachment
 */
export interface Attachment extends AttachmentLike {
  filename?: string | false;
  cid?: string;
  encoding?: string;
  contentType?: string;
  contentTransferEncoding?: string;
  contentDisposition?: string;
  headers?: Record<string, string | string[]>;
  raw?: string | Buffer | NodeJS.ReadableStream | AttachmentLike;
}

/**
 * Full message options
 */
export interface MessageOptions {
  html: string;
  text?: string;
  subject?: string;
  context?: Record<string, unknown>; // For templating

  from?: string | Address;
  sender?: string | Address;
  to?: string | Address | (string | Address)[];
  cc?: string | Address | (string | Address)[];
  bcc?: string | Address | (string | Address)[];
  replyTo?: string | Address;
  inReplyTo?: string | Address;
  references?: string | string[];
  headers?: Record<string, string | string[]>;
  attachments?: Attachment[];
  alternatives?: Attachment[];
  messageId?: string;
  date?: Date | string;
  encoding?: string;
}

export type SentMessage = {
  messageId?: string;
};