/**
 * PostgreSQL storage. Every Imago collection is stored as JSON documents in one table,
 * which mirrors the front end's `Collection<T>` contract (list/get/insert/update/remove).
 * Connection settings come from the standard PG* variables (PGHOST, PGUSER, PGPASSWORD, PGDATABASE).
 */
import pg from 'pg';

export const pool = new pg.Pool({ max: 10 });

export type Doc = { id: string };

export async function migrate() {
  await pool.query(`
    create table if not exists docs (
      collection text not null,
      id text not null,
      seq bigserial,
      data jsonb not null,
      updated_at timestamptz not null default now(),
      primary key (collection, id)
    );
    create index if not exists docs_collection_seq on docs (collection, seq);

    create table if not exists sessions (
      id text primary key,
      user_id text not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      ip text,
      user_agent text
    );
    create index if not exists sessions_user on sessions (user_id);

    create table if not exists files (
      id text primary key,
      name text not null,
      content_type text not null,
      data bytea not null,
      created_at timestamptz not null default now()
    );

    create table if not exists meta (
      key text primary key,
      value jsonb not null
    );
  `);
}

export async function listDocs<T = Doc>(collection: string): Promise<T[]> {
  const r = await pool.query('select data from docs where collection = $1 order by seq', [collection]);
  return r.rows.map((row) => row.data as T);
}

export async function getDoc<T = Doc>(collection: string, id: string): Promise<T | undefined> {
  const r = await pool.query('select data from docs where collection = $1 and id = $2', [collection, id]);
  return r.rows[0]?.data as T | undefined;
}

export async function insertDoc<T extends Doc>(collection: string, doc: T): Promise<T> {
  await pool.query('insert into docs (collection, id, data) values ($1, $2, $3)', [collection, doc.id, doc]);
  return doc;
}

/** Shallow-merge `patch` into an existing document (same semantics as the browser backend). */
export async function updateDoc<T extends Doc>(collection: string, id: string, patch: Partial<T>): Promise<T | undefined> {
  const r = await pool.query(
    `update docs set data = data || $3::jsonb, updated_at = now()
     where collection = $1 and id = $2 returning data`,
    [collection, id, { ...patch, id }],
  );
  return r.rows[0]?.data as T | undefined;
}

export async function removeDoc(collection: string, id: string): Promise<void> {
  await pool.query('delete from docs where collection = $1 and id = $2', [collection, id]);
}

export async function replaceAll<T extends Doc>(collection: string, rows: T[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from docs where collection = $1', [collection]);
    for (const row of rows) {
      await client.query('insert into docs (collection, id, data) values ($1, $2, $3)', [collection, row.id, row]);
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

export async function countDocs(collection: string): Promise<number> {
  const r = await pool.query('select count(*)::int as n from docs where collection = $1', [collection]);
  return r.rows[0].n as number;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const r = await pool.query('select value from meta where key = $1', [key]);
  return r.rows[0]?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await pool.query(
    'insert into meta (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value',
    [key, JSON.stringify(value)],
  );
}

export async function saveFile(id: string, name: string, contentType: string, data: Buffer) {
  await pool.query(
    'insert into files (id, name, content_type, data) values ($1, $2, $3, $4) on conflict (id) do nothing',
    [id, name, contentType, data],
  );
}

export async function getFile(id: string) {
  const r = await pool.query('select name, content_type, data from files where id = $1', [id]);
  const row = r.rows[0];
  return row ? { name: row.name as string, contentType: row.content_type as string, data: row.data as Buffer } : undefined;
}
