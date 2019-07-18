import { Readable } from 'stream';
import { Url } from 'url';

interface Address {
  name: string;
  address: string;
}

interface AttachmentLike {
  content?: string | Buffer | Readable;
  path?: string | Url;
}

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