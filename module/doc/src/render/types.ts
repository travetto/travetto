import { AllType, AllTypeMap } from '../node-types';

export type AllChildren = AllType;
export type AnchorType = AllTypeMap['Anchor'];

export type OutputContext = {
  preamble: string;
  module: string;
  content: string;
  gitRoot: string;
};

export type DocumentContext = {
  assemble?: Record<string, (output: OutputContext) => string>;
  text: AllType;
};

export type Renderer = {
  ext: string;
  render(child: AllChildren): string;
  assemble(output: OutputContext): string;
  finalize(output: string, context: OutputContext): string;
  toc(title: string, anchors: AnchorType[]): string;
};
