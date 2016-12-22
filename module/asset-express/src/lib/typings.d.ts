declare module Express {
	export interface MultipartyUpload {
		name: string;
		size?: number;
		type?: string;
		path: string;
		hash: string;
	}

	export interface File {
		stream?: NodeJS.ReadableStream;
		length: number;
		filename: string;
		contentType: string;
		path: string;
		metadata: {
			name: string,
			title: string,
			hash: string,
			createdDate: Date,
			tags?: string[]
		},
		read(): Promise<string>
	}

	export interface Request {
		files: { [key: string]: File }
	}
}