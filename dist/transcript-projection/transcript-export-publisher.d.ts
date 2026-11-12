import type { TranscriptExportFormat } from "./transcript-projection.js";
export interface PublishTranscriptExportInput {
    readonly content: Buffer;
    readonly dataRoot: string;
    readonly format: TranscriptExportFormat;
    readonly outputPath: string;
    readonly overwrite: boolean;
    readonly signal?: AbortSignal;
}
export interface PublishedTranscriptExport {
    readonly bytes: number;
    readonly outputPath: string;
    readonly sha256: string;
}
export declare function validateTranscriptExportPathSyntax(outputPath: unknown, format: TranscriptExportFormat): asserts outputPath is string;
export declare function publishTranscriptExport(input: PublishTranscriptExportInput): Promise<PublishedTranscriptExport>;
