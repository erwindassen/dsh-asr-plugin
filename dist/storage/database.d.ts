import { DatabaseSync } from "node:sqlite";
export declare function openMeetingDatabase(filename: string): DatabaseSync;
export declare function inWriteTransaction<T>(database: DatabaseSync, operation: () => T): T;
export declare function inReadOperation<T>(operation: () => T): T;
export declare function inReadTransaction<T>(database: DatabaseSync, operation: () => T): T;
