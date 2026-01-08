import type { Readable } from 'node:stream';
import type { Url } from 'node:url';

import type { FileLoader } from '@travetto/runtime';

/**
 * An address
 */
export interface EmailAddress {
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
export interface EmailAttachment extends AttachmentLike {
  filename?: string | false;
  cid?: string;
  encoding?: string;
  contentType?: string;
  contentTransferEncoding?: false | '7bit' | 'base64' | 'quoted-printable';
  contentDisposition?: 'attachment' | 'inline';
  headers?: Record<string, string | string[]>;
  raw?: string | Buffer | Readable | AttachmentLike;
}

type EmailContentType = 'html' | 'text' | 'subject';

export type EmailIdentity = string | EmailAddress;
export type EmailIdentityList = EmailIdentity | EmailIdentity[];

/**
 * Full message options
 * @concrete
 */
export interface EmailOptions {
  html: string;
  text?: string;
  subject: string;
  context?: Record<string, unknown>; // For templating

  disableThreading?: boolean;

  from?: EmailIdentity;
  sender?: EmailIdentity;
  to?: EmailIdentityList;
  cc?: EmailIdentityList;
  bcc?: EmailIdentityList;
  replyTo?: EmailIdentity;
  inReplyTo?: EmailIdentity;
  references?: string | string[];
  headers?: Record<string, string | string[]>;
  attachments?: EmailAttachment[];
  alternatives?: EmailAttachment[];
  messageId?: string;
  date?: Date | string;
  encoding?: string;
}

export type SentEmail = {
  messageId?: string;
};

export type EmailCompiled = Record<EmailContentType, string>;

// Compilation support, defined here to allow for templates to not have a direct dependency on the compiler
export type EmailTemplateResource = {
  loader: FileLoader;
  inlineStyle?: boolean;
  inlineImages?: boolean;
  globalStyles?: string;
};

type EmailTemplateContent = Record<EmailContentType, () => (Promise<string> | string)>;

export type EmailTemplateLocation = { file: string, module: string };
export type EmailTemplateModule = EmailTemplateResource & EmailTemplateContent;
export type EmailTemplateImport = { prepare(location: EmailTemplateLocation): Promise<EmailTemplateModule> };