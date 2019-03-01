const ERROR_CATEGORIES_WITH_CODES = {
  general: [500, 501],
  notfound: [404, 416],
  data: [400, 411, 414, 415, 431, 417, 428],
  permissions: [403],
  authentication: [401, 407, 511],
  timeout: [408, 504],
  unavailable: [503, 502, 429]
};

export type ErrorCategory = keyof typeof ERROR_CATEGORIES_WITH_CODES;

export const HTTP_ERROR_CONVERSION = (Object.entries(ERROR_CATEGORIES_WITH_CODES) as [ErrorCategory, number[]][])
  .reduce(
    (acc, [typ, codes]) => {
      codes.forEach(c => acc.to.set(c, typ));
      acc.from.set(typ, codes[0]);
      return acc;
    },
    {
      to: new Map<number, ErrorCategory>(),
      from: new Map<ErrorCategory, number>()
    }
  );

export class AppError extends Error {
  type: string;

  constructor(
    public message: string,
    public category: ErrorCategory = 'general',
    public payload?: { [key: string]: any },

  ) {
    super(message);
    this.type = this.constructor.name;
    this.stack = this.stack;
  }

  toJSON(extra: { [key: string]: any } = {}) {
    if (this.payload) {
      Object.assign(extra, this.payload);
    }
    return JSON.stringify({
      ...extra,
      message: this.message,
      category: this.category,
      type: this.type
    });
  }
}