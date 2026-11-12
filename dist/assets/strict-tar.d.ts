export interface ExpectedTarFile {
    readonly byteLength: number;
    readonly install: boolean;
    readonly relativePath: string;
    readonly sha256: string;
}
export declare function extractStrictTar(options: {
    archivePath: string;
    destinationRoot?: string;
    onManifest: (bytes: Buffer) => readonly ExpectedTarFile[];
    signal?: AbortSignal;
}): Promise<void>;
