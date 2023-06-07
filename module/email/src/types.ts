import { Readable } from 'stream';
import { Url } from 'url';

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

/**
 * Full message options
 */
export interface EmailOptions {
  html: string;
  text?: string;
  subject: string;
  context?: Record<string, unknown>; // For templating

  from?: string | EmailAddress;
  sender?: string | EmailAddress;
  to?: string | EmailAddress | (string | EmailAddress)[];
  cc?: string | EmailAddress | (string | EmailAddress)[];
  bcc?: string | EmailAddress | (string | EmailAddress)[];
  replyTo?: string | EmailAddress;
  inReplyTo?: string | EmailAddress;
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
type BaseTemplateConfig = {
  search?: string[];
  inline?: boolean;
};

export type EmailTemplateStyleConfig = BaseTemplateConfig & { global?: string };
export type EmailTemplateImageConfig = BaseTemplateConfig & {};

export type EmailTemplateConfig = {
  styles?: EmailTemplateStyleConfig;
  images?: EmailTemplateImageConfig;
};

export type EmailTemplateLocation = { file: string, module: string };
export type EmailRenderer = (ctx: EmailTemplateLocation & EmailTemplateConfig) => Promise<string> | string;
export type EmailCompileSource = EmailTemplateConfig & Record<EmailContentType, EmailRenderer>;
export type EmailCompileContext = EmailTemplateLocation & EmailCompileSource;
