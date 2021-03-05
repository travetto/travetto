import { AllType, AllTypeMap } from '../node-types';

export type AllChildren = AllType;
export type AnchorType = AllTypeMap['Anchor'];

export type OutputContext = {
  header?: string;
  toc?: string;
  preamble: string;
  module: string;
  content: string;
};

export type DocumentContext = {
  header?: boolean;
  finalize?: Record<string, (output: OutputContext) => string>;
  toc?: string;
  text: AllType;
};

export type Renderer = {
  ext: string;
  render(child: AllChildren): string;
  finalize(output: OutputContext): string;
  toc(title: string, anchors: AnchorType[]): string;
};
