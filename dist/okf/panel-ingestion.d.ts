import type { OkfIngestRpcValue } from "../recording/rpc-contract.js";
import type { OkfIngestionService } from "./ingestion-service.js";
/**
 * Ingestion as the recording panel sees it. The panel starts one meeting and
 * then polls the same meeting, so the adapter only has to translate the
 * service's outcomes and attempt rows into one wire shape.
 */
export interface PanelIngestion {
    start(meetingId: string, options: {
        readonly force: boolean;
    }): Promise<OkfIngestRpcValue>;
    status(meetingId: string): OkfIngestRpcValue;
}
/**
 * Attempts that were started but have not reached the database yet. A job is
 * queued synchronously but `beginAttempt` happens inside the job, so between
 * the two the service has no row to report.
 */
export declare function panelIngestion(service: OkfIngestionService): PanelIngestion;
