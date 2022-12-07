declare namespace PrismAlt {
  export interface Grammar { }
  export const languages: { [language: string]: Grammar; };
  export const plugins: Record<string, {
    setDefaults(cfg: Record<string, unknown>): void;
    normalize(text: string, config?: unknown): string;
  }>;
  export function highlight(
    text: string,
    grammar: Grammar,
    language: string
  ): string;
}

declare module "prismjs" {
  export default PrismAlt;
}