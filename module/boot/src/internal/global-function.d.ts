/**
 * Extensions to the Function interface, to provide common
 * information for all registered classes
 */
declare interface Function {
  ᚕid: string;
  ᚕfile: string;
  ᚕfileRaw: string;
  ᚕhash: number;
  ᚕmethods: Record<string, { hash: number }>;
  ᚕsynthetic: boolean;
  ᚕabstract: boolean;
}