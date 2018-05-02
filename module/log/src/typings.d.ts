declare module NodeJS {
  export interface Console {
    fatal: (msg?: string, ...extra: any[]) => void
  }
}