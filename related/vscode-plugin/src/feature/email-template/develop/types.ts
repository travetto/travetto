export type Content = { html: string, text: string, subject: string };

export type EmailTemplateCommand =
  { type: 'redraw', file?: string } |
  { type: 'send', file?: string } |
  { type: 'configure' };

export type EmailTemplateEvent =
  { type: 'changed', file: string, content?: Content } |
  { type: 'changed-failed' } |
  { type: 'configured', file: string } |
  { type: 'sent' } |
  { type: 'sent-failed' };
