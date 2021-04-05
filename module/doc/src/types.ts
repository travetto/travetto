export interface DocNode { _type: string }

export type Content = DocNode | string;

export type TextType = { _type: 'text', content: string };

export type Wrapper = Record<string, (c: string) => string>;

/**
 * Document file shape
 */
export interface DocumentShape<T extends DocNode = DocNode> {
  text: T | (() => (T | Promise<T>));
  wrap?: Wrapper;
}

/**
 * Render context shape
 */
export interface RenderContextShape {

  /**
   * Filename
   */
  file: string;

  /**
   * Github root for project
   */
  gitBaseUrl: string;

  /**
   * Github root for travetto framework
   */
  travettoGitBaseUrl: string;

  /**
   * Local folder root for git
   */
  gitFolder: string;

  /**
   * Get table of contents
   */
  toc(root: DocNode): DocNode;

  /**
   * Generate link location
   */
  link(text: string, line?: number | { [key: string]: unknown, line?: number }): string;

  /**
   * Clean text
   */
  cleanText(a?: string): string;

  /**
   * Get a consistent anchor id
   */
  getAnchorId(a: string): string;
};

/**
 * Renderer support
 */
export type Renderer = {
  ext: string;
  render(node: DocNode, context: RenderContextShape, root?: DocNode): string;
};
