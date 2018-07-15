
declare const AppInfo: {
  VERSION: string,
  NAME: string,
  SIMPLE_NAME: string,
  SUB_NAME: string,
  PACKAGE: string,
  LICENSE: string,
  AUTHOR: string,
  DESCRIPTION: string,
  DEV_PACKAGES: string[]
};

declare function resolveFrameworkFile(pth: string): string;