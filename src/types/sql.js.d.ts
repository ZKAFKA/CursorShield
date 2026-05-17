declare module 'sql.js' {
    interface SqlJsStatic {
        Database: new (data?: ArrayLike<number> | Buffer) => Database;
    }

    interface Database {
        exec(sql: string, params?: unknown[]): QueryExecResult[];
        run(sql: string, params?: unknown[]): Database;
        close(): void;
        export(): Uint8Array;
        getRowsModified(): number;
    }

    interface QueryExecResult {
        columns: string[];
        values: unknown[][];
    }

    interface SqlJsConfig {
        locateFile?: (file: string) => string;
    }

    export type { SqlJsStatic, Database, QueryExecResult, SqlJsConfig };

    export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}