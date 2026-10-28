/**
 * SQLite durable storage and schema migrations for Bara local core.
 * Handles schema migration, serialized transactions, and durable persistence.
 */

import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';

let dbInstance: SQLiteDatabase | null = null;
let dbPromise: Promise<SQLiteDatabase> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Enqueues a database write operation in a strict serialized queue to prevent concurrent write collisions.
 */
export async function withWriteLock<T>(action: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const currentDb = await getDatabase();
  const next = writeQueue.then(() => action(currentDb));
  writeQueue = next.catch(() => {});
  return next;
}

/**
 * Returns the singleton SQLiteDatabase instance, initializing and running migrations if needed.
 * Uses a memoized singleflight promise to prevent concurrent migration / initialization races.
 */
export async function getDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync('bara.db');

      // Enable WAL mode and foreign keys for durability and performance
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
      `);

      await runMigrations(db);
      dbInstance = db;
      return db;
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }

  return dbPromise;
}

/**
 * Executes incremental schema migrations.
 */
async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const row = await db.getFirstAsync<{ version: number }>(
    'SELECT MAX(version) as version FROM schema_version'
  );
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      // 1. Reports table
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          revision INTEGER NOT NULL DEFAULT 1,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          observationTime TEXT NOT NULL,
          timezone TEXT NOT NULL,
          rawText TEXT NOT NULL,
          reviewedText TEXT NOT NULL,
          observerLocation TEXT,
          incidentLocationText TEXT NOT NULL,
          includeObserverLocation INTEGER NOT NULL DEFAULT 0,
          suggestion TEXT,
          suggestionRevision INTEGER
        );
      `);

      // 2. Attachments table
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS attachments (
          id TEXT PRIMARY KEY,
          reportId TEXT NOT NULL,
          uri TEXT NOT NULL,
          analysisUri TEXT NOT NULL,
          hash TEXT NOT NULL,
          mime TEXT NOT NULL,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          bytes INTEGER NOT NULL,
          source TEXT NOT NULL,
          selectedForShare INTEGER NOT NULL DEFAULT 1,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_attachments_report ON attachments(reportId);
      `);

      // 3. Share attempts table
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS share_attempts (
          id TEXT PRIMARY KEY,
          reportId TEXT NOT NULL,
          at TEXT NOT NULL,
          event TEXT NOT NULL,
          channelId TEXT,
          FOREIGN KEY (reportId) REFERENCES reports(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_shares_report ON share_attempts(reportId);
      `);

      // 4. Model state table
      await txn.execAsync(`
        CREATE TABLE IF NOT EXISTS model_states (
          candidateId TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          status TEXT NOT NULL,
          downloadedBytes INTEGER NOT NULL DEFAULT 0,
          totalBytes INTEGER NOT NULL DEFAULT 0,
          requiredBytes INTEGER NOT NULL DEFAULT 0,
          error TEXT,
          lastLocalCheck TEXT,
          modelPath TEXT,
          projectorPath TEXT,
          updatedAt TEXT NOT NULL
        );
      `);

      await txn.runAsync(
        'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)',
        1,
        new Date().toISOString()
      );
    });
  }
}
