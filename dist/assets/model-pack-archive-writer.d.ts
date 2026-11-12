import type { FileHandle } from "node:fs/promises";
export interface OpenModelPackFile {
    readonly assetId: string;
    readonly byteLength: number;
    readonly handle: FileHandle;
    readonly relativePath: string;
    readonly sha256: string;
}
export declare function writeModelPackArchive(outputPath: string, manifestBytes: Buffer, files: readonly OpenModelPackFile[], signal?: AbortSignal): Promise<{
    archiveByteLength: number;
    archiveSha256: string;
}>;
