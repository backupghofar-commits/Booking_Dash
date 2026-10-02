declare module 'better-sqlite3' {
  interface Statement {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }
  interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): this;
    pragma(src: string): unknown;
    transaction<T extends (...args: never[]) => unknown>(fn: T): T;
    close(): void;
  }
  interface DatabaseConstructor {
    new (filename: string, options?: { readonly?: boolean; fileMustExist?: boolean; timeout?: number }): Database;
  }
  const Database: DatabaseConstructor;
  export default Database;
}
