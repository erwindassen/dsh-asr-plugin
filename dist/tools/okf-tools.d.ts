import type { Context } from "@deepseek-ai/cordis";
import type { OkfPageWriteRegistry } from "../okf/write-session.js";
export declare const OKF_WRITE_PAGE_TOOL = "okf_write_page";
export declare function registerOkfTools(context: Context, deps: {
    readonly pages: OkfPageWriteRegistry;
}): void;
