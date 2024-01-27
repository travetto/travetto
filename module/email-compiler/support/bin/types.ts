export type EditorRequest =
  { type: 'configure', file: string } |
  { type: 'compile', file: string } |
  { type: 'send', file: string, from?: string, to?: string };

export type EditorResponse =
  { type: 'configured', file: string } |
  { type: 'sent', to: string, file: string, url?: string | false } |
  { type: 'compiled', file: string, content: Record<'html' | 'subject' | 'text', string> } |
  { type: 'sent-failed', message: string, stack: Error['stack'], to: string, file: string } |
  { type: 'compiled-failed', message: string, stack: Error['stack'], file: string } |
  { type: 'init' };

export type EditorSender = {
  port?: number;
  host?: string;
  auth?: {
    user?: string;
    pass?: string;
  };
};

export interface EditorConfigType {
  to: string;
  from: string;
  context?: Record<string, unknown>;
  sender?: EditorSender;
}
