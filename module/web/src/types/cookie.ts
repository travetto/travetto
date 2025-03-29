export type CookieReadOptions = { signed?: boolean };

export type Cookie = {
  name: string;
  value?: string;
  expires?: Date;
  signed?: boolean;
  maxAge?: number;
  path?: string;
  domain?: string;
  priority?: 'low' | 'medium' | 'high';
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
  httpOnly?: boolean;
  partitioned?: boolean;
};


export type CookieSetOptions = Omit<Cookie, 'name' | 'value'>;