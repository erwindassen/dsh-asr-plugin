import { chmod } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
const SQLITE_BUSY = 5;
const SQLITE_PRIMARY_CODE_MASK = 0xff;
export function isSqliteBusy(error) {
    if (typeof error !== "object" || error === null)
        return false;
    const failure = error;
    return failure.code === "ERR_SQLITE_ERROR" &&
        Number.isInteger(failure.errcode) &&
        (failure.errcode & SQLITE_PRIMARY_CODE_MASK) === SQLITE_BUSY;
}
function closeQuietly(database) {
    try {
        if (database?.isOpen === true)
            database.close();
    }
    catch {
        // Preserve the acquisition failure.
    }
}
class SqliteExclusiveLease {
    database;
    constructor(database) {
        this.database = database;
    }
    async [Symbol.asyncDispose]() {
        if (!this.database.isOpen)
            return;
        try {
            if (this.database.isTransaction)
                this.database.exec("ROLLBACK");
        }
        finally {
            if (this.database.isOpen)
                this.database.close();
        }
    }
}
export async function openSqliteExclusiveLease(path) {
    let database;
    try {
        database = new DatabaseSync(path);
        await chmod(path, 0o600);
        database.exec(`
      PRAGMA busy_timeout = 0;
      PRAGMA journal_mode = MEMORY;
      PRAGMA trusted_schema = OFF;
      BEGIN EXCLUSIVE;
    `);
        return new SqliteExclusiveLease(database);
    }
    catch (error) {
        closeQuietly(database);
        throw error;
    }
}
//# sourceMappingURL=sqlite-exclusive-lease.js.map