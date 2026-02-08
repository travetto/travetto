import type { Url } from 'node:url';

import type { BinaryType, FileLoader } from '@travetto/runtime';

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
interface AttachmentLike<B extends BinaryType = BinaryType> {
  content?: B | string;
  path?: string | Url;
}

/**
 * A full attachment
 */
export interface EmailAttachment<B extends BinaryType = BinaryType> extends AttachmentLike<B> {
  filename?: string | false;
  cid?: string;
  encoding?: string;
  contentType?: string;
  contentTransferEncoding?: false | '7bit' | 'base64' | 'quoted-printable';
  contentDisposition?: 'attachment' | 'inline';
  headers?: Record<string, string | string[]>;
  raw?: B | string;
}

type EmailContentType = 'html' | 'text' | 'subject';

export type EmailIdentity = string | EmailAddress;
export type EmailIdentityList = EmailIdentity | EmailIdentity[];

/**
 * Full message options
 * @concrete
 */
export interface EmailOptions<B extends BinaryType = BinaryType> {
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
  attachments?: EmailAttachment<B>[];
  alternatives?: EmailAttachment<B>[];
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