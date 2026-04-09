"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listStaff = listStaff;
exports.getStaffById = getStaffById;
exports.getAllActiveStaff = getAllActiveStaff;
exports.saveStaff = saveStaff;
exports.updateStaffPermissions = updateStaffPermissions;
exports.getStaffSnapshotById = getStaffSnapshotById;
exports.restoreStaffFromSnapshot = restoreStaffFromSnapshot;
exports.countStaffByShop = countStaffByShop;
exports.reassignStaffToShop = reassignStaffToShop;
exports.deleteStaff = deleteStaff;
exports.deleteStaffMany = deleteStaffMany;
exports.updateStaffStatus = updateStaffStatus;
exports.findLocalStaffByUsername = findLocalStaffByUsername;
exports.findLocalAccessForLogin = findLocalAccessForLogin;
exports.applyLocalAccessToUser = applyLocalAccessToUser;
exports.authenticateLocalStaffLogin = authenticateLocalStaffLogin;
const node_fs_1 = __importDefault(require("node:fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const data_path_1 = require("./data-path");
const shop_store_1 = require("./shop-store");
const DATA_DIR = (0, data_path_1.getDataDir)();
const DB_PATH = (0, data_path_1.getDataFilePath)("staff.sqlite");
const DEFAULT_MODULE_PERMISSIONS = ["installment", "shop"];
let dbInstance = null;
function getDb() {
    if (dbInstance) {
        return dbInstance;
    }
    node_fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    const db = new better_sqlite3_1.default(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_user_id INTEGER,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL DEFAULT '',
      full_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      work_address TEXT NOT NULL DEFAULT '',
      shop_id INTEGER NOT NULL DEFAULT 0,
      shop_name TEXT NOT NULL DEFAULT '',
      status INTEGER NOT NULL DEFAULT 1,
      created_date TEXT NOT NULL,
      created_date_display TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      can_access_all_shops INTEGER NOT NULL DEFAULT 0,
      allowed_shop_ids TEXT NOT NULL DEFAULT '[]',
      module_permissions TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
    const columns = db.prepare("PRAGMA table_info(staff)").all();
    if (!columns.some((column) => String(column.name ?? "") === "password_hash")) {
        db.exec("ALTER TABLE staff ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''");
    }
    dbInstance = db;
    return db;
}
function formatIsoDate(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function formatDisplayDate(isoDate) {
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return isoDate;
    }
    return `${match[3]}/${match[2]}/${match[1]}`;
}
function normalizeDateValue(value) {
    const raw = String(value ?? "").trim();
    if (!raw) {
        const now = new Date();
        const isoDate = formatIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
        return { isoDate, displayDate: formatDisplayDate(isoDate) };
    }
    const normalized = raw.replace(/\./g, "/").replace(/-/g, "/");
    const ddmmyyyy = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
        const isoDate = formatIsoDate(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]), Number(ddmmyyyy[1]));
        return { isoDate, displayDate: formatDisplayDate(isoDate) };
    }
    const yyyymmdd = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (yyyymmdd) {
        const isoDate = formatIsoDate(Number(yyyymmdd[1]), Number(yyyymmdd[2]), Number(yyyymmdd[3]));
        return { isoDate, displayDate: formatDisplayDate(isoDate) };
    }
    const fallback = new Date(raw);
    if (!Number.isNaN(fallback.getTime())) {
        const isoDate = formatIsoDate(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate());
        return { isoDate, displayDate: formatDisplayDate(isoDate) };
    }
    throw new Error("Ngay tao nhan vien khong hop le.");
}
function parseOptionalNumber(value) {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}
function parseStatus(value) {
    return String(value ?? "1").trim() === "0" ? 0 : 1;
}
function parseRole(value) {
    return String(value ?? "").trim() === "admin" ? "admin" : "staff";
}
function parseBooleanFlag(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}
function normalizeIdList(value, fallbackShopId) {
    const rawValues = Array.isArray(value) ? value : String(value ?? "").split(",");
    const ids = new Set();
    for (const item of rawValues) {
        const parsed = Number(String(item ?? "").trim());
        if (Number.isFinite(parsed) && parsed > 0) {
            ids.add(parsed);
        }
    }
    if (fallbackShopId && fallbackShopId > 0) {
        ids.add(fallbackShopId);
    }
    return Array.from(ids).sort((left, right) => left - right);
}
function normalizeModulePermissions(value, role) {
    if (role === "admin") {
        return ["installment", "shop", "staff"];
    }
    const rawValues = Array.isArray(value) ? value : String(value ?? "").split(",");
    const values = new Set();
    for (const item of rawValues) {
        const normalized = String(item ?? "").trim();
        if (normalized === "installment" || normalized === "shop" || normalized === "staff") {
            values.add(normalized);
        }
    }
    if (values.size === 0) {
        for (const permission of DEFAULT_MODULE_PERMISSIONS) {
            values.add(permission);
        }
    }
    return Array.from(values);
}
function readJsonArray(value, fallback) {
    try {
        const parsed = JSON.parse(String(value ?? "[]"));
        return Array.isArray(parsed) ? parsed : fallback;
    }
    catch (error) {
        return fallback;
    }
}
function mapStaffRow(row) {
    const status = Number(row.status ?? 1);
    const role = parseRole(row.role);
    return {
        id: Number(row.id),
        remoteUserId: row.remote_user_id === null || row.remote_user_id === undefined ? null : Number(row.remote_user_id),
        username: String(row.username ?? ""),
        fullName: String(row.full_name ?? ""),
        email: String(row.email ?? ""),
        phone: String(row.phone ?? ""),
        workAddress: String(row.work_address ?? ""),
        shopId: Number(row.shop_id ?? 0),
        shopName: String(row.shop_name ?? ""),
        status,
        statusText: status === 1 ? "Đang làm việc" : "Tạm khóa",
        createdDate: String(row.created_date ?? ""),
        createdDateDisplay: String(row.created_date_display ?? ""),
        role,
        canAccessAllShops: Number(row.can_access_all_shops ?? 0) === 1,
        allowedShopIds: readJsonArray(row.allowed_shop_ids, []),
        modulePermissions: normalizeModulePermissions(readJsonArray(row.module_permissions, []), role),
        updatedAt: String(row.updated_at ?? "")
    };
}
function getExistingPasswordHash(staffId) {
    const db = getDb();
    const row = db.prepare("SELECT password_hash FROM staff WHERE id = ?").get(staffId);
    return String(row?.password_hash ?? "");
}
function normalizePasswordHash(inputPassword, existingPasswordHash, requirePassword) {
    const rawPassword = String(inputPassword ?? "").trim();
    if (rawPassword) {
        return bcryptjs_1.default.hashSync(rawPassword, 10);
    }
    if (existingPasswordHash) {
        return existingPasswordHash;
    }
    if (requirePassword) {
        throw new Error("Vui lòng nhập mật khẩu cho nhân viên.");
    }
    return "";
}
function sanitizeFilters(filters) {
    return {
        generalSearch: String(filters.generalSearch || "").trim(),
        status: typeof filters.status === "number" ? filters.status : null,
        searchShopId: typeof filters.searchShopId === "number" ? filters.searchShopId : null,
        page: Math.max(1, Number(filters.page || 1)),
        perPage: Math.min(200, Math.max(10, Number(filters.perPage || 50))),
        sortColumn: String(filters.sortColumn || "createdDate"),
        sortDirection: filters.sortDirection === "asc" ? "asc" : "desc",
        allowedShopIds: Array.isArray(filters.allowedShopIds) ? filters.allowedShopIds : undefined
    };
}
function buildScopedWhereClauses(filters) {
    const whereClauses = [];
    const bindings = [];
    if (filters.generalSearch) {
        const keyword = `%${filters.generalSearch.toLowerCase()}%`;
        whereClauses.push(`(
      LOWER(username) LIKE ?
      OR LOWER(full_name) LIKE ?
      OR LOWER(email) LIKE ?
      OR LOWER(phone) LIKE ?
      OR LOWER(work_address) LIKE ?
      OR LOWER(shop_name) LIKE ?
    )`);
        bindings.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }
    if (filters.status !== null && filters.status !== 100) {
        whereClauses.push("status = ?");
        bindings.push(filters.status === 0 ? 0 : 1);
    }
    if (filters.searchShopId !== null && filters.searchShopId !== 0) {
        whereClauses.push("shop_id = ?");
        bindings.push(filters.searchShopId);
    }
    if (filters.allowedShopIds && filters.allowedShopIds.length > 0) {
        const placeholders = filters.allowedShopIds.map(() => "?").join(", ");
        whereClauses.push(`shop_id IN (${placeholders})`);
        bindings.push(...filters.allowedShopIds);
    }
    return {
        whereSql: whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "",
        bindings
    };
}
function normalizeInput(input) {
    const existingPasswordHash = String(input.existingPasswordHash ?? "");
    const requirePassword = Boolean(input.requirePassword);
    const username = String(input.username ?? "").trim().toLowerCase();
    if (!username) {
        throw new Error("Tai khoan nhan vien khong duoc de trong.");
    }
    const fullName = String(input.fullName ?? "").trim();
    if (!fullName) {
        throw new Error("Ho ten nhan vien khong duoc de trong.");
    }
    const shopId = parseOptionalNumber(input.shopId) ?? 0;
    const shop = shopId > 0 ? (0, shop_store_1.getShopById)(shopId) : null;
    if (!shop) {
        throw new Error("Vui lòng chọn cửa hàng hợp lệ cho nhân viên.");
    }
    const role = parseRole(input.role);
    const canAccessAllShops = role === "admin" ? true : parseBooleanFlag(input.canAccessAllShops);
    const allowedShopIds = canAccessAllShops ? [] : normalizeIdList(input.allowedShopIds, shop.id);
    const modulePermissions = normalizeModulePermissions(input.modulePermissions, role);
    const { isoDate, displayDate } = normalizeDateValue(input.createdDate);
    return {
        remoteUserId: parseOptionalNumber(input.remoteUserId),
        username,
        passwordHash: normalizePasswordHash(input.password, existingPasswordHash, requirePassword),
        fullName,
        email: String(input.email ?? "").trim(),
        phone: String(input.phone ?? "").trim(),
        workAddress: String(input.workAddress ?? "").trim(),
        shopId: shop.id,
        shopName: shop.name,
        status: parseStatus(input.status),
        createdDate: isoDate,
        createdDateDisplay: displayDate,
        role,
        canAccessAllShops: canAccessAllShops ? 1 : 0,
        allowedShopIds: JSON.stringify(allowedShopIds),
        modulePermissions: JSON.stringify(modulePermissions)
    };
}
function listStaff(filters) {
    const db = getDb();
    const sanitized = sanitizeFilters(filters);
    const { whereSql, bindings } = buildScopedWhereClauses(sanitized);
    const allowedSortColumns = {
        username: "username",
        fullName: "full_name",
        shopName: "shop_name",
        phone: "phone",
        createdDate: "created_date",
        status: "status"
    };
    const sortColumn = allowedSortColumns[sanitized.sortColumn] ? sanitized.sortColumn : "createdDate";
    const orderBySql = `${allowedSortColumns[sortColumn]} ${sanitized.sortDirection.toUpperCase()}, id DESC`;
    const offset = (sanitized.page - 1) * sanitized.perPage;
    const totalRow = db.prepare(`SELECT COUNT(*) AS count FROM staff ${whereSql}`).get(...bindings);
    const summaryRow = db
        .prepare(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END), 0) AS activeCount,
        COALESCE(SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END), 0) AS inactiveCount
      FROM staff
      ${whereSql}
    `)
        .get(...bindings);
    const rows = db
        .prepare(`
      SELECT *
      FROM staff
      ${whereSql}
      ORDER BY ${orderBySql}
      LIMIT ?
      OFFSET ?
    `)
        .all(...bindings, sanitized.perPage, offset);
    return {
        items: rows.map(mapStaffRow),
        total: Number(totalRow.count || 0),
        page: sanitized.page,
        perPage: sanitized.perPage,
        totalPages: Math.max(1, Math.ceil(Number(totalRow.count || 0) / sanitized.perPage)),
        sortColumn,
        sortDirection: sanitized.sortDirection,
        summary: {
            count: Number(summaryRow.count || 0),
            activeCount: Number(summaryRow.activeCount || 0),
            inactiveCount: Number(summaryRow.inactiveCount || 0)
        }
    };
}
function getStaffById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM staff WHERE id = ?").get(id);
    return row ? mapStaffRow(row) : null;
}
function getAllActiveStaff(allowedShopIds) {
    return listStaff({
        status: 1,
        page: 1,
        perPage: 500,
        sortColumn: "fullName",
        sortDirection: "asc",
        allowedShopIds
    }).items;
}
function saveStaff(input, staffId) {
    const db = getDb();
    const existingPasswordHash = staffId ? getExistingPasswordHash(staffId) : "";
    if (staffId && !getStaffById(staffId)) {
        throw new Error("Không tìm thấy nhân viên để cập nhật.");
    }
    const normalized = normalizeInput({
        ...input,
        existingPasswordHash,
        requirePassword: !staffId || !existingPasswordHash
    });
    if (staffId) {
        const result = db
            .prepare(`
        UPDATE staff
        SET
          remote_user_id = @remoteUserId,
          username = @username,
          password_hash = @passwordHash,
          full_name = @fullName,
          email = @email,
          phone = @phone,
          work_address = @workAddress,
          shop_id = @shopId,
          shop_name = @shopName,
          status = @status,
          created_date = @createdDate,
          created_date_display = @createdDateDisplay,
          role = @role,
          can_access_all_shops = @canAccessAllShops,
          allowed_shop_ids = @allowedShopIds,
          module_permissions = @modulePermissions,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `)
            .run({
            ...normalized,
            id: staffId
        });
        if (result.changes === 0) {
            throw new Error("Không tìm thấy nhân viên để cập nhật.");
        }
        return getStaffById(staffId);
    }
    const result = db
        .prepare(`
      INSERT INTO staff (
        remote_user_id,
        username,
        password_hash,
        full_name,
        email,
        phone,
        work_address,
        shop_id,
        shop_name,
        status,
        created_date,
        created_date_display,
        role,
        can_access_all_shops,
        allowed_shop_ids,
        module_permissions,
        updated_at
      ) VALUES (
        @remoteUserId,
        @username,
        @passwordHash,
        @fullName,
        @email,
        @phone,
        @workAddress,
        @shopId,
        @shopName,
        @status,
        @createdDate,
        @createdDateDisplay,
        @role,
        @canAccessAllShops,
        @allowedShopIds,
        @modulePermissions,
        CURRENT_TIMESTAMP
      )
    `)
        .run(normalized);
    return getStaffById(Number(result.lastInsertRowid));
}
function updateStaffPermissions(staffId, input) {
    const staff = getStaffById(staffId);
    if (!staff) {
        throw new Error("Không tìm thấy nhân viên để phân quyền.");
    }
    return saveStaff({
        remoteUserId: staff.remoteUserId,
        username: staff.username,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        workAddress: staff.workAddress,
        status: staff.status,
        createdDate: staff.createdDate,
        role: input.role ?? staff.role,
        shopId: input.shopId ?? staff.shopId,
        canAccessAllShops: input.canAccessAllShops ?? (staff.canAccessAllShops ? "1" : "0"),
        allowedShopIds: input.allowedShopIds ?? staff.allowedShopIds,
        modulePermissions: input.modulePermissions ?? staff.modulePermissions
    }, staffId);
}
function getStaffSnapshotById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM staff WHERE id = ?").get(id);
    return row || null;
}
function restoreStaffFromSnapshot(snapshot) {
    const restoredId = Number(snapshot?.id || 0);
    if (!Number.isFinite(restoredId) || restoredId <= 0) {
        throw new Error("Du lieu nhan vien trong thung rac khong hop le.");
    }
    if (getStaffSnapshotById(restoredId)) {
        throw new Error("Không thể khôi phục nhân viên vì ID đã tồn tại.");
    }
    const db = getDb();
    db.prepare(`
      INSERT INTO staff (
        id,
        remote_user_id,
        username,
        password_hash,
        full_name,
        email,
        phone,
        work_address,
        shop_id,
        shop_name,
        status,
        created_date,
        created_date_display,
        role,
        can_access_all_shops,
        allowed_shop_ids,
        module_permissions,
        updated_at
      ) VALUES (
        @id,
        @remote_user_id,
        @username,
        @password_hash,
        @full_name,
        @email,
        @phone,
        @work_address,
        @shop_id,
        @shop_name,
        @status,
        @created_date,
        @created_date_display,
        @role,
        @can_access_all_shops,
        @allowed_shop_ids,
        @module_permissions,
        CURRENT_TIMESTAMP
      )
    `).run({
        id: restoredId,
        remote_user_id: snapshot.remote_user_id ?? null,
        username: String(snapshot.username ?? "").trim(),
        password_hash: String(snapshot.password_hash ?? ""),
        full_name: String(snapshot.full_name ?? ""),
        email: String(snapshot.email ?? ""),
        phone: String(snapshot.phone ?? ""),
        work_address: String(snapshot.work_address ?? ""),
        shop_id: Number(snapshot.shop_id ?? 0),
        shop_name: String(snapshot.shop_name ?? ""),
        status: Number(snapshot.status ?? 1) === 0 ? 0 : 1,
        created_date: String(snapshot.created_date ?? ""),
        created_date_display: String(snapshot.created_date_display ?? ""),
        role: parseRole(snapshot.role),
        can_access_all_shops: Number(snapshot.can_access_all_shops ?? 0) === 1 ? 1 : 0,
        allowed_shop_ids: JSON.stringify(readJsonArray(snapshot.allowed_shop_ids, [])),
        module_permissions: JSON.stringify(normalizeModulePermissions(readJsonArray(snapshot.module_permissions, []), parseRole(snapshot.role)))
    });
    return getStaffById(restoredId);
}
function countStaffByShop(shopId) {
    if (!Number.isFinite(shopId) || shopId <= 0) {
        return 0;
    }
    const db = getDb();
    const row = db
        .prepare(`
      SELECT COUNT(*) AS total
      FROM staff
      WHERE shop_id = ?
    `)
        .get(shopId);
    return Number(row?.total || 0);
}
function normalizeAllowedShopIdsForTransfer(rawValue, sourceShopId, targetShopId) {
    const sourceId = Number(sourceShopId);
    const targetId = Number(targetShopId);
    const currentValues = Array.isArray(rawValue) ? rawValue : readJsonArray(rawValue, []);
    const result = new Set();
    for (const value of currentValues) {
        const normalized = Number(value);
        if (!Number.isFinite(normalized) || normalized <= 0) {
            continue;
        }
        result.add(normalized === sourceId ? targetId : normalized);
    }
    if (result.size === 0 && Number.isFinite(targetId) && targetId > 0) {
        result.add(targetId);
    }
    return Array.from(result).sort((left, right) => left - right);
}
function reassignStaffToShop(sourceShopId, targetShopId, targetShopName) {
    const normalizedSourceId = Number(sourceShopId);
    const normalizedTargetId = Number(targetShopId);
    const normalizedTargetName = String(targetShopName || "").trim();
    if (!Number.isFinite(normalizedSourceId) ||
        normalizedSourceId <= 0 ||
        !Number.isFinite(normalizedTargetId) ||
        normalizedTargetId <= 0 ||
        normalizedSourceId === normalizedTargetId ||
        !normalizedTargetName) {
        return 0;
    }
    const db = getDb();
    const rows = db
        .prepare(`
      SELECT id, can_access_all_shops, allowed_shop_ids
      FROM staff
      WHERE shop_id = ?
    `)
        .all(normalizedSourceId);
    if (rows.length === 0) {
        return 0;
    }
    const runTransfer = db.transaction(() => {
        for (const row of rows) {
            const canAccessAllShops = Number(row.can_access_all_shops ?? 0) === 1;
            const nextAllowedShopIds = canAccessAllShops
                ? []
                : normalizeAllowedShopIdsForTransfer(row.allowed_shop_ids, normalizedSourceId, normalizedTargetId);
            db.prepare(`
          UPDATE staff
          SET
            shop_id = ?,
            shop_name = ?,
            allowed_shop_ids = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(normalizedTargetId, normalizedTargetName, JSON.stringify(nextAllowedShopIds), Number(row.id));
        }
        return rows.length;
    });
    return runTransfer();
}
function deleteStaff(id) {
    const db = getDb();
    return db.prepare("DELETE FROM staff WHERE id = ?").run(id).changes > 0;
}
function deleteStaffMany(ids) {
    const normalizedIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.trunc(id))));
    if (normalizedIds.length === 0) {
        return 0;
    }
    const db = getDb();
    const placeholders = normalizedIds.map(() => "?").join(", ");
    return Number(db.prepare(`DELETE FROM staff WHERE id IN (${placeholders})`).run(...normalizedIds).changes || 0);
}
function updateStaffStatus(ids, status) {
    const normalizedIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.trunc(id))));
    if (normalizedIds.length === 0) {
        return 0;
    }
    const db = getDb();
    const placeholders = normalizedIds.map(() => "?").join(", ");
    return Number(db
        .prepare(`
        UPDATE staff
        SET
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${placeholders})
      `)
        .run(status === 0 ? 0 : 1, ...normalizedIds).changes || 0);
}
function findLocalAccessForLogin(username, remoteUserId) {
    const db = getDb();
    const row = db
        .prepare(`
      SELECT *
      FROM staff
      WHERE status = 1
        AND (
          remote_user_id = @remoteUserId
          OR LOWER(username) = LOWER(@username)
        )
      ORDER BY
        CASE WHEN remote_user_id = @remoteUserId THEN 0 ELSE 1 END,
        id ASC
      LIMIT 1
    `)
        .get({
        remoteUserId,
        username
    });
    return row ? mapStaffRow(row) : null;
}
function findLocalStaffByUsername(username) {
    const db = getDb();
    const row = db
        .prepare(`
      SELECT *
      FROM staff
      WHERE LOWER(username) = LOWER(@username)
      LIMIT 1
    `)
        .get({
        username
    });
    return row ? mapStaffRow(row) : null;
}
function authenticateLocalStaffLogin(username, password) {
    const db = getDb();
    const row = db
        .prepare(`
      SELECT *
      FROM staff
      WHERE status = 1
        AND LOWER(username) = LOWER(@username)
      ORDER BY id ASC
      LIMIT 1
    `)
        .get({
        username
    });
    if (!row) {
        return null;
    }
    const passwordHash = String(row.password_hash ?? "");
    if (!passwordHash || !bcryptjs_1.default.compareSync(String(password ?? ""), passwordHash)) {
        return null;
    }
    const staff = mapStaffRow(row);
    return {
        user: {
            id: staff.id,
            username: staff.username,
            displayName: staff.fullName || staff.username,
            role: staff.role,
            shopId: staff.shopId,
            allowedShopIds: staff.canAccessAllShops
                ? []
                : staff.allowedShopIds.length > 0
                    ? staff.allowedShopIds
                    : staff.shopId > 0
                        ? [staff.shopId]
                        : [],
            canAccessAllShops: staff.canAccessAllShops || staff.role === "admin",
            modulePermissions: staff.modulePermissions,
            token: `local-${staff.id}`,
            cookieHeader: "",
            menus: []
        },
        staff
    };
}
function applyLocalAccessToUser(user) {
    const localStaff = findLocalAccessForLogin(user.username, user.id);
    if (!localStaff) {
        return {
            ...user,
            allowedShopIds: user.shopId > 0 ? [user.shopId] : [],
            canAccessAllShops: user.role === "admin",
            modulePermissions: user.role === "admin" ? ["installment", "shop", "staff"] : DEFAULT_MODULE_PERMISSIONS
        };
    }
    return {
        ...user,
        displayName: localStaff.fullName || user.displayName,
        role: localStaff.role,
        shopId: localStaff.shopId || user.shopId,
        allowedShopIds: localStaff.canAccessAllShops
            ? []
            : localStaff.allowedShopIds.length > 0
                ? localStaff.allowedShopIds
                : localStaff.shopId > 0
                    ? [localStaff.shopId]
                    : [],
        canAccessAllShops: localStaff.canAccessAllShops || localStaff.role === "admin",
        modulePermissions: localStaff.modulePermissions
    };
}
