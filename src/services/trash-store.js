"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTrashItem = addTrashItem;
exports.listTrashItems = listTrashItems;
exports.getTrashItemById = getTrashItemById;
exports.markTrashItemRestored = markTrashItemRestored;
const node_fs_1 = require("node:fs");
const better_sqlite3_1 = require("better-sqlite3");
const data_path_1 = require("./data-path");
const DATA_DIR = (0, data_path_1.getDataDir)();
const DB_PATH = (0, data_path_1.getDataFilePath)("trash.sqlite");
let dbInstance = null;
function getDb() {
    if (dbInstance) {
        return dbInstance;
    }
    (0, node_fs_1.mkdirSync)(DATA_DIR, { recursive: true });
    const db = new better_sqlite3_1(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
    CREATE TABLE IF NOT EXISTS trash_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL DEFAULT '{}',
      metadata TEXT NOT NULL DEFAULT '{}',
      deleted_by TEXT NOT NULL DEFAULT '',
      deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      restored_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_trash_items_entity_type ON trash_items(entity_type);
    CREATE INDEX IF NOT EXISTS idx_trash_items_restored_at ON trash_items(restored_at);
    CREATE INDEX IF NOT EXISTS idx_trash_items_deleted_at ON trash_items(deleted_at);
  `);
    dbInstance = db;
    return db;
}
function parseJson(value, fallback) {
    try {
        const parsed = JSON.parse(String(value ?? ""));
        return parsed && typeof parsed === "object" ? parsed : fallback;
    }
    catch (error) {
        return fallback;
    }
}
function mapTrashRow(row) {
    return {
        id: Number(row.id),
        entityType: String(row.entity_type ?? ""),
        entityId: Number(row.entity_id ?? 0),
        label: String(row.label ?? ""),
        payload: parseJson(row.payload, {}),
        metadata: parseJson(row.metadata, {}),
        deletedBy: String(row.deleted_by ?? ""),
        deletedAt: String(row.deleted_at ?? ""),
        restoredAt: String(row.restored_at ?? "")
    };
}
function addTrashItem(input) {
    const entityType = String(input.entityType ?? "").trim().toLowerCase();
    const entityId = Number(input.entityId ?? 0);
    if (!entityType || !Number.isFinite(entityId) || entityId <= 0) {
        throw new Error("Không thể lưu thùng rác vì dữ liệu đầu vào không hợp lệ.");
    }
    const db = getDb();
    const result = db
        .prepare(`
      INSERT INTO trash_items (
        entity_type,
        entity_id,
        label,
        payload,
        metadata,
        deleted_by,
        deleted_at,
        restored_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, '')
    `)
        .run(entityType, entityId, String(input.label ?? "").trim(), JSON.stringify(input.payload ?? {}), JSON.stringify(input.metadata ?? {}), String(input.deletedBy ?? "").trim());
    return Number(result.lastInsertRowid || 0);
}
function sanitizeListFilters(filters) {
    return {
        entityType: String(filters.entityType || "").trim().toLowerCase(),
        generalSearch: String(filters.generalSearch || "").trim().toLowerCase(),
        page: Math.max(1, Number(filters.page || 1)),
        perPage: Math.min(200, Math.max(10, Number(filters.perPage || 50))),
        includeRestored: Boolean(filters.includeRestored)
    };
}
function listTrashItems(filters) {
    const db = getDb();
    const sanitized = sanitizeListFilters(filters);
    const whereClauses = [];
    const bindings = [];
    if (!sanitized.includeRestored) {
        whereClauses.push("TRIM(restored_at) = ''");
    }
    if (sanitized.entityType) {
        whereClauses.push("entity_type = ?");
        bindings.push(sanitized.entityType);
    }
    if (sanitized.generalSearch) {
        const keyword = `%${sanitized.generalSearch}%`;
        whereClauses.push("(LOWER(label) LIKE ? OR LOWER(entity_type) LIKE ? OR LOWER(deleted_by) LIKE ?)");
        bindings.push(keyword, keyword, keyword);
    }
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const offset = (sanitized.page - 1) * sanitized.perPage;
    const totalRow = db.prepare(`SELECT COUNT(*) AS count FROM trash_items ${whereSql}`).get(...bindings);
    const rows = db
        .prepare(`
      SELECT *
      FROM trash_items
      ${whereSql}
      ORDER BY deleted_at DESC, id DESC
      LIMIT ?
      OFFSET ?
    `)
        .all(...bindings, sanitized.perPage, offset);
    const entityTypeRows = db
        .prepare(`
      SELECT DISTINCT entity_type
      FROM trash_items
      WHERE TRIM(restored_at) = ''
      ORDER BY entity_type ASC
    `)
        .all();
    return {
        items: rows.map(mapTrashRow),
        total: Number(totalRow?.count || 0),
        page: sanitized.page,
        perPage: sanitized.perPage,
        totalPages: Math.max(1, Math.ceil(Number(totalRow?.count || 0) / sanitized.perPage)),
        availableEntityTypes: entityTypeRows.map((item) => String(item.entity_type || "")).filter(Boolean)
    };
}
function getTrashItemById(id) {
    const normalizedId = Number(id);
    if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
        return null;
    }
    const db = getDb();
    const row = db.prepare("SELECT * FROM trash_items WHERE id = ?").get(normalizedId);
    return row ? mapTrashRow(row) : null;
}
function markTrashItemRestored(id) {
    const normalizedId = Number(id);
    if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
        return false;
    }
    const db = getDb();
    const result = db
        .prepare(`
      UPDATE trash_items
      SET restored_at = CURRENT_TIMESTAMP
      WHERE id = ? AND TRIM(restored_at) = ''
    `)
        .run(normalizedId);
    return Number(result.changes || 0) > 0;
}
