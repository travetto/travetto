import { AllType, AllTypeMap } from '../node-types';

export type AllChildren = AllType;

export type RenderContext = {
  module: string;
  toc: AllTypeMap['Ordered'];
  gitRoot: string;
};

export type DocumentContext = {
  assemble?: Record<string, (output: string) => string>;
  text: AllType;
};

export type Renderer = {
  ext: string;
  render(child: AllChildren, context: RenderContext): string;
  assemble?(output: string): string;
};
