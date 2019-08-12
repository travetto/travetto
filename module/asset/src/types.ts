export interface AssetMetadata {
  name: string;
  title: string;
  hash: string;
  createdDate: Date;
  tags?: string[];
}

export interface Asset {
  stream: NodeJS.ReadableStream;
  size: number;
  path: string;
  contentType: string;
  metadata: AssetMetadata;
}
