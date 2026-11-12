export declare function isSqliteBusy(error: unknown): boolean;
export declare function openSqliteExclusiveLease(path: string): Promise<AsyncDisposable>;
