"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAuditLog = writeAuditLog;
exports.writeAuditLogFromRequest = writeAuditLogFromRequest;
exports.listAuditLogs = listAuditLogs;
exports.listAuditLogsForExport = listAuditLogsForExport;
const node_fs_1 = __importDefault(require("node:fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const data_path_1 = require("./data-path");
const DATA_DIR = (0, data_path_1.getDataDir)();
const DB_PATH = (0, data_path_1.getDataFilePath)("audit-log.sqlite");
let dbInstance = null;
function getDb() {
    if (dbInstance) {
        return dbInstance;
    }
    node_fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    const db = new better_sqlite3_1.default(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      actor_username TEXT NOT NULL DEFAULT '',
      actor_display_name TEXT NOT NULL DEFAULT '',
      actor_role TEXT NOT NULL DEFAULT '',
      shop_id INTEGER,
      shop_name TEXT NOT NULL DEFAULT '',
      module_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT '',
      path TEXT NOT NULL DEFAULT '',
      entity_type TEXT NOT NULL DEFAULT '',
      entity_id TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
    dbInstance = db;
    return db;
}
function toDateOnly(value) {
    return value.slice(0, 10);
}
function sanitizeFilters(filters) {
    return {
        generalSearch: String(filters.generalSearch || "").trim(),
        moduleName: String(filters.moduleName || "").trim(),
        actionType: String(filters.actionType || "").trim(),
        actorUsername: String(filters.actorUsername || "").trim(),
        shopId: typeof filters.shopId === "number" ? filters.shopId : null,
        fromDate: String(filters.fromDate || "").trim(),
        toDate: String(filters.toDate || "").trim(),
        page: Math.max(1, Number(filters.page || 1)),
        perPage: Math.min(200, Math.max(10, Number(filters.perPage || 50))),
        allowedShopIds: Array.isArray(filters.allowedShopIds)
            ? filters.allowedShopIds
                .map((value) => Number(value))
                .filter((value, index, values) => Number.isFinite(value) && value > 0 && values.indexOf(value) === index)
            : [],
        viewerUserId: typeof filters.viewerUserId === "number" && Number.isFinite(filters.viewerUserId) ? filters.viewerUserId : null
    };
}
function mapLogRow(row) {
    const createdAt = String(row.created_at ?? "");
    return {
        id: Number(row.id),
        actorUserId: row.actor_user_id === null || row.actor_user_id === undefined ? null : Number(row.actor_user_id),
        actorUsername: String(row.actor_username ?? ""),
        actorDisplayName: String(row.actor_display_name ?? ""),
        actorRole: String(row.actor_role ?? ""),
        shopId: row.shop_id === null || row.shop_id === undefined ? null : Number(row.shop_id),
        shopName: String(row.shop_name ?? ""),
        moduleName: String(row.module_name ?? ""),
        actionType: String(row.action_type ?? ""),
        method: String(row.method ?? ""),
        path: String(row.path ?? ""),
        entityType: String(row.entity_type ?? ""),
        entityId: String(row.entity_id ?? ""),
        description: String(row.description ?? ""),
        metadata: String(row.metadata ?? "{}"),
        ipAddress: String(row.ip_address ?? ""),
        createdAt,
        createdDate: toDateOnly(createdAt)
    };
}
function buildAuditLogWhereClause(sanitized) {
    const whereClauses = [];
    const bindings = [];
    if (sanitized.allowedShopIds.length > 0 && sanitized.viewerUserId !== null) {
        const placeholders = sanitized.allowedShopIds.map(() => "?").join(", ");
        whereClauses.push(`(shop_id IN (${placeholders}) OR actor_user_id = ?)`);
        bindings.push(...sanitized.allowedShopIds, sanitized.viewerUserId);
    }
    else if (sanitized.allowedShopIds.length > 0) {
        const placeholders = sanitized.allowedShopIds.map(() => "?").join(", ");
        whereClauses.push(`shop_id IN (${placeholders})`);
        bindings.push(...sanitized.allowedShopIds);
    }
    else if (sanitized.viewerUserId !== null) {
        whereClauses.push("actor_user_id = ?");
        bindings.push(sanitized.viewerUserId);
    }
    if (sanitized.generalSearch) {
        const keyword = `%${sanitized.generalSearch.toLowerCase()}%`;
        whereClauses.push(`(
      LOWER(actor_username) LIKE ?
      OR LOWER(actor_display_name) LIKE ?
      OR LOWER(shop_name) LIKE ?
      OR LOWER(module_name) LIKE ?
      OR LOWER(action_type) LIKE ?
      OR LOWER(path) LIKE ?
      OR LOWER(description) LIKE ?
      OR LOWER(entity_type) LIKE ?
      OR LOWER(entity_id) LIKE ?
    )`);
        bindings.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword, keyword, keyword);
    }
    if (sanitized.moduleName) {
        whereClauses.push("module_name = ?");
        bindings.push(sanitized.moduleName);
    }
    if (sanitized.actionType) {
        whereClauses.push("action_type = ?");
        bindings.push(sanitized.actionType);
    }
    if (sanitized.actorUsername) {
        whereClauses.push("LOWER(actor_username) LIKE ?");
        bindings.push(`%${sanitized.actorUsername.toLowerCase()}%`);
    }
    if (sanitized.shopId !== null && sanitized.shopId !== 0) {
        whereClauses.push("shop_id = ?");
        bindings.push(sanitized.shopId);
    }
    if (sanitized.fromDate) {
        whereClauses.push("DATE(created_at) >= DATE(?)");
        bindings.push(sanitized.fromDate);
    }
    if (sanitized.toDate) {
        whereClauses.push("DATE(created_at) <= DATE(?)");
        bindings.push(sanitized.toDate);
    }
    return {
        whereSql: whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "",
        bindings
    };
}
function writeAuditLog(input) {
    const db = getDb();
    db.prepare(`
    INSERT INTO audit_logs (
      actor_user_id,
      actor_username,
      actor_display_name,
      actor_role,
      shop_id,
      shop_name,
      module_name,
      action_type,
      method,
      path,
      entity_type,
      entity_id,
      description,
      metadata,
      ip_address,
      created_at
    ) VALUES (
      @actorUserId,
      @actorUsername,
      @actorDisplayName,
      @actorRole,
      @shopId,
      @shopName,
      @moduleName,
      @actionType,
      @method,
      @path,
      @entityType,
      @entityId,
      @description,
      @metadata,
      @ipAddress,
      CURRENT_TIMESTAMP
    )
  `).run({
        actorUserId: input.actorUserId ?? null,
        actorUsername: input.actorUsername ?? "",
        actorDisplayName: input.actorDisplayName ?? "",
        actorRole: input.actorRole ?? "",
        shopId: input.shopId ?? null,
        shopName: input.shopName ?? "",
        moduleName: input.moduleName,
        actionType: input.actionType,
        method: input.method ?? "",
        path: input.path ?? "",
        entityType: input.entityType ?? "",
        entityId: input.entityId == null ? "" : String(input.entityId),
        description: input.description,
        metadata: JSON.stringify(input.metadata || {}),
        ipAddress: input.ipAddress ?? ""
    });
}
function writeAuditLogFromRequest(user, reqLike, input) {
    writeAuditLog({
        actorUserId: user?.id ?? null,
        actorUsername: user?.username ?? "",
        actorDisplayName: user?.displayName ?? "",
        actorRole: user?.role ?? "",
        shopId: input.shopId ?? (user?.shopId ?? null),
        shopName: input.shopName ?? "",
        method: reqLike.method ?? "",
        path: reqLike.originalUrl ?? "",
        ipAddress: reqLike.ip ?? "",
        ...input
    });
}
function listAuditLogs(filters) {
    const db = getDb();
    const sanitized = sanitizeFilters(filters);
    const { whereSql, bindings } = buildAuditLogWhereClause(sanitized);
    const offset = (sanitized.page - 1) * sanitized.perPage;
    const totalRow = db.prepare(`SELECT COUNT(*) AS count FROM audit_logs ${whereSql}`).get(...bindings);
    const rows = db
        .prepare(`
      SELECT *
      FROM audit_logs
      ${whereSql}
      ORDER BY id DESC
      LIMIT ?
      OFFSET ?
    `)
        .all(...bindings, sanitized.perPage, offset);
    const availableModules = db.prepare(`SELECT DISTINCT module_name FROM audit_logs ${whereSql} ORDER BY module_name ASC`).all(...bindings).map((row) => row.module_name);
    const availableActions = db.prepare(`SELECT DISTINCT action_type FROM audit_logs ${whereSql} ORDER BY action_type ASC`).all(...bindings).map((row) => row.action_type);
    return {
        items: rows.map(mapLogRow),
        total: Number(totalRow.count || 0),
        page: sanitized.page,
        perPage: sanitized.perPage,
        totalPages: Math.max(1, Math.ceil(Number(totalRow.count || 0) / sanitized.perPage)),
        availableModules,
        availableActions
    };
}
function listAuditLogsForExport(filters) {
    const db = getDb();
    const sanitized = sanitizeFilters({
        ...filters,
        page: 1,
        perPage: 200
    });
    const { whereSql, bindings } = buildAuditLogWhereClause(sanitized);
    const rows = db
        .prepare(`
      SELECT *
      FROM audit_logs
      ${whereSql}
      ORDER BY id DESC
    `)
        .all(...bindings);
    return rows.map(mapLogRow);
}
