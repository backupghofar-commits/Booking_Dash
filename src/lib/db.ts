import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { migrate } from './db-migrate';

type SqliteDb = InstanceType<typeof Database>;
const globalForDb = globalThis as unknown as { sqlite?: SqliteDb };

function resolveDbPath() {
  const raw = process.env.DATABASE_URL || 'file:./dev.db';
  const file = raw.replace(/^file:/, '');
  return path.isAbsolute(file) ? file : path.join(process.cwd(), file);
}

function open() {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  migrate(sqlite);
  return sqlite;
}

export const sqlite = globalForDb.sqlite ?? open();
if (process.env.NODE_ENV !== 'production') globalForDb.sqlite = sqlite;

export function nowIso() {
  return new Date().toISOString();
}
