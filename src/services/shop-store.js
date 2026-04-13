"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listShops = listShops;
exports.getShopById = getShopById;
exports.saveShop = saveShop;
exports.getShopSnapshotById = getShopSnapshotById;
exports.restoreShopFromSnapshot = restoreShopFromSnapshot;
exports.deleteShop = deleteShop;
exports.deleteShops = deleteShops;
exports.updateShopStatus = updateShopStatus;
exports.getAllShopOptions = getAllShopOptions;
const node_fs_1 = __importDefault(require("node:fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const data_path_1 = require("./data-path");
const localities_1 = require("./localities");
const DATA_DIR = (0, data_path_1.getDataDir)();
const DB_PATH = (0, data_path_1.getDataFilePath)("shops.sqlite");
let dbInstance = null;
function getDb() {
    if (dbInstance) {
        return dbInstance;
    }
    node_fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    const db = new better_sqlite3_1.default(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      represent TEXT NOT NULL DEFAULT '',
      total_money INTEGER NOT NULL DEFAULT 0,
      status INTEGER NOT NULL DEFAULT 1,
      created_date TEXT NOT NULL,
      created_date_display TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
    ensureColumn(db, "shops", "address_detail", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, "shops", "province_code", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, "shops", "province_name", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, "shops", "district_name", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, "shops", "ward_code", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, "shops", "ward_name", "TEXT NOT NULL DEFAULT ''");
    dbInstance = db;
    return db;
}
function ensureColumn(db, tableName, columnName, columnDefinition) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (columns.some((column) => column.name === columnName)) {
        return;
    }
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
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
function parseNumericValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    const raw = String(value ?? "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/[₫đd]|vnđ|vnd/gi, "");
    if (!raw) {
        return Number.NaN;
    }
    const sanitized = raw.replace(/[^0-9.,-]/g, "");
    if (!sanitized) {
        return Number.NaN;
    }
    let normalizedNumber = sanitized;
    const dotCount = (sanitized.match(/\./g) || []).length;
    const commaCount = (sanitized.match(/,/g) || []).length;
    if (dotCount > 0 && commaCount > 0) {
        const decimalSeparator = sanitized.lastIndexOf(".") > sanitized.lastIndexOf(",") ? "." : ",";
        const groupSeparator = decimalSeparator === "." ? "," : ".";
        normalizedNumber = sanitized.split(groupSeparator).join("");
        if (decimalSeparator === ",") {
            normalizedNumber = normalizedNumber.replace(",", ".");
        }
    }
    else if (dotCount > 0 || commaCount > 0) {
        const separator = dotCount > 0 ? "." : ",";
        const separatorCount = dotCount > 0 ? dotCount : commaCount;
        if (separatorCount > 1) {
            normalizedNumber = sanitized.split(separator).join("");
        }
        else {
            const separatorIndex = sanitized.lastIndexOf(separator);
            const digitsAfterSeparator = sanitized.length - separatorIndex - 1;
            if (digitsAfterSeparator === 3) {
                normalizedNumber = sanitized.replace(separator, "");
            }
            else if (digitsAfterSeparator <= 2) {
                normalizedNumber = sanitized.replace(separator, ".");
            }
            else {
                normalizedNumber = sanitized.replace(separator, "");
            }
        }
    }
    const parsed = Number(normalizedNumber);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
}
function parseMoney(value) {
    const parsed = parseNumericValue(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}
function parseStatus(value) {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return 1;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
        return parsed === 0 ? 0 : 1;
    }
    const normalized = raw.toLowerCase();
    return normalized.includes("tam") || normalized.includes("dung") || normalized.includes("ngung") ? 0 : 1;
}
function normalizeDateValue(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const isoDate = formatIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
        return { isoDate, displayDate: formatDisplayDate(isoDate) };
    }
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
    throw new Error("Ngay tao cua hang khong hop le.");
}
function mapShopRow(row) {
    const status = Number(row.status ?? 1);
    const addressDetail = String(row.address_detail ?? "").trim();
    const provinceCode = String(row.province_code ?? "").trim();
    const provinceName = String(row.province_name ?? "").trim();
    const districtName = String(row.district_name ?? "").trim();
    const wardCode = String(row.ward_code ?? "").trim();
    const wardName = String(row.ward_name ?? "").trim();
    return {
        id: Number(row.id),
        name: String(row.name ?? ""),
        address: String(row.address ?? ""),
        addressDetail: addressDetail || String(row.address ?? ""),
        provinceCode,
        provinceName,
        districtName,
        wardCode,
        wardName,
        phone: String(row.phone ?? ""),
        represent: String(row.represent ?? ""),
        totalMoney: Number(row.total_money ?? 0),
        status,
        statusText: status === 1 ? "Đang hoạt động" : "Đã tạm dừng",
        createdDate: String(row.created_date ?? ""),
        createdDateDisplay: String(row.created_date_display ?? ""),
        updatedAt: String(row.updated_at ?? "")
    };
}
function sanitizeFilters(filters) {
    return {
        generalSearch: String(filters.generalSearch || "").trim(),
        status: typeof filters.status === "number" ? filters.status : null,
        page: Math.max(1, Number(filters.page || 1)),
        perPage: Math.min(200, Math.max(10, Number(filters.perPage || 50))),
        sortColumn: String(filters.sortColumn || "createdDate"),
        sortDirection: filters.sortDirection === "asc" ? "asc" : "desc",
        allowedIds: Array.isArray(filters.allowedIds) ? filters.allowedIds : undefined
    };
}
function normalizeInput(input) {
    const name = String(input.name ?? "").trim();
    if (!name) {
        throw new Error("Ten cua hang khong duoc de trong.");
    }
    const { isoDate, displayDate } = normalizeDateValue(input.createdDate);
    const addressDetail = String(input.addressDetail ?? "").trim();
    const districtName = String(input.districtName ?? "").trim();
    const provinceCode = String(input.provinceCode ?? "").trim();
    const wardCode = String(input.wardCode ?? "").trim();
    const province = (0, localities_1.getProvinceByCode)(provinceCode);
    const ward = province ? (0, localities_1.getWardByCode)(province.code, wardCode) : null;
    if (!province) {
        throw new Error("Vui lòng chọn tỉnh/thành phố hợp lệ.");
    }
    if (!ward) {
        throw new Error("Vui lòng chọn phường/xã hợp lệ.");
    }
    const addressParts = [addressDetail, districtName, ward.name, province.name].filter(Boolean);
    return {
        name,
        address: addressParts.join(", "),
        addressDetail,
        provinceCode: province.code,
        provinceName: province.name,
        districtName,
        wardCode: ward.code,
        wardName: ward.name,
        phone: String(input.phone ?? "").trim(),
        represent: String(input.represent ?? "").trim(),
        totalMoney: parseMoney(input.totalMoney),
        status: parseStatus(input.status),
        createdDate: isoDate,
        createdDateDisplay: displayDate
    };
}
function listShops(filters) {
    const db = getDb();
    const sanitized = sanitizeFilters(filters);
    const whereClauses = [];
    const bindings = [];
    if (sanitized.generalSearch) {
        const keyword = `%${sanitized.generalSearch.toLowerCase()}%`;
        whereClauses.push(`(
      LOWER(name) LIKE ?
      OR LOWER(address) LIKE ?
      OR LOWER(phone) LIKE ?
      OR LOWER(represent) LIKE ?
    )`);
        bindings.push(keyword, keyword, keyword, keyword);
    }
    if (sanitized.status !== null && sanitized.status !== 100) {
        whereClauses.push("status = ?");
        bindings.push(sanitized.status === 0 ? 0 : 1);
    }
    if (sanitized.allowedIds && sanitized.allowedIds.length > 0) {
        const placeholders = sanitized.allowedIds.map(() => "?").join(", ");
        whereClauses.push(`id IN (${placeholders})`);
        bindings.push(...sanitized.allowedIds);
    }
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const allowedSortColumns = {
        name: "name",
        address: "address",
        phone: "phone",
        totalMoney: "total_money",
        createdDate: "created_date",
        status: "status"
    };
    const sortColumn = allowedSortColumns[sanitized.sortColumn] ? sanitized.sortColumn : "createdDate";
    const orderBySql = `${allowedSortColumns[sortColumn]} ${sanitized.sortDirection.toUpperCase()}, id DESC`;
    const offset = (sanitized.page - 1) * sanitized.perPage;
    const totalRow = db.prepare(`SELECT COUNT(*) AS count FROM shops ${whereSql}`).get(...bindings);
    const summaryRow = db
        .prepare(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(total_money), 0) AS totalMoney,
        COALESCE(SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END), 0) AS activeCount,
        COALESCE(SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END), 0) AS inactiveCount
      FROM shops
      ${whereSql}
    `)
        .get(...bindings);
    const dashboardRow = db
        .prepare(`
      SELECT
        COUNT(*) AS totalShops,
        COALESCE(SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END), 0) AS activeShops,
        COALESCE(SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END), 0) AS inactiveShops,
        COALESCE(SUM(total_money), 0) AS totalMoney,
        COALESCE(AVG(CASE WHEN total_money > 0 THEN total_money END), 0) AS averageMoney
      FROM shops
      ${whereSql}
    `)
        .get(...bindings);
    const rows = db
        .prepare(`
      SELECT
        id,
        name,
        address,
        address_detail,
        province_code,
        province_name,
        district_name,
        ward_code,
        ward_name,
        phone,
        represent,
        total_money,
        status,
        created_date,
        created_date_display,
        updated_at
      FROM shops
      ${whereSql}
      ORDER BY ${orderBySql}
      LIMIT ?
      OFFSET ?
    `)
        .all(...bindings, sanitized.perPage, offset);
    return {
        items: rows.map(mapShopRow),
        total: Number(totalRow.count || 0),
        page: sanitized.page,
        perPage: sanitized.perPage,
        totalPages: Math.max(1, Math.ceil(Number(totalRow.count || 0) / sanitized.perPage)),
        sortColumn,
        sortDirection: sanitized.sortDirection,
        summary: {
            count: Number(summaryRow.count || 0),
            totalMoney: Number(summaryRow.totalMoney || 0),
            activeCount: Number(summaryRow.activeCount || 0),
            inactiveCount: Number(summaryRow.inactiveCount || 0)
        },
        dashboard: {
            totalShops: Number(dashboardRow.totalShops || 0),
            activeShops: Number(dashboardRow.activeShops || 0),
            inactiveShops: Number(dashboardRow.inactiveShops || 0),
            totalMoney: Number(dashboardRow.totalMoney || 0),
            averageMoney: Number(dashboardRow.averageMoney || 0)
        }
    };
}
function getShopById(id) {
    const db = getDb();
    const row = db
        .prepare(`
      SELECT
        id,
        name,
        address,
        address_detail,
        province_code,
        province_name,
        district_name,
        ward_code,
        ward_name,
        phone,
        represent,
        total_money,
        status,
        created_date,
        created_date_display,
        updated_at
      FROM shops
      WHERE id = ?
    `)
        .get(id);
    return row ? mapShopRow(row) : null;
}
function saveShop(input, shopId) {
    const db = getDb();
    const normalized = normalizeInput(input);
    if (shopId) {
        const result = db
            .prepare(`
        UPDATE shops
        SET
          name = @name,
          address = @address,
          address_detail = @addressDetail,
          province_code = @provinceCode,
          province_name = @provinceName,
          district_name = @districtName,
          ward_code = @wardCode,
          ward_name = @wardName,
          phone = @phone,
          represent = @represent,
          total_money = @totalMoney,
          status = @status,
          created_date = @createdDate,
          created_date_display = @createdDateDisplay,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `)
            .run({
            ...normalized,
            id: shopId
        });
        if (result.changes === 0) {
            throw new Error("Không tìm thấy cửa hàng để cập nhật.");
        }
        return getShopById(shopId);
    }
    const result = db
        .prepare(`
      INSERT INTO shops (
        name,
        address,
        address_detail,
        province_code,
        province_name,
        district_name,
        ward_code,
        ward_name,
        phone,
        represent,
        total_money,
        status,
        created_date,
        created_date_display,
        updated_at
      ) VALUES (
        @name,
        @address,
        @addressDetail,
        @provinceCode,
        @provinceName,
        @districtName,
        @wardCode,
        @wardName,
        @phone,
        @represent,
        @totalMoney,
        @status,
        @createdDate,
        @createdDateDisplay,
        CURRENT_TIMESTAMP
      )
    `)
        .run(normalized);
    return getShopById(Number(result.lastInsertRowid));
}
function getShopSnapshotById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM shops WHERE id = ?").get(id);
    return row || null;
}
function restoreShopFromSnapshot(snapshot) {
    const restoredId = Number(snapshot?.id || 0);
    if (!Number.isFinite(restoredId) || restoredId <= 0) {
        throw new Error("Du lieu cua hang trong thung rac khong hop le.");
    }
    if (getShopSnapshotById(restoredId)) {
        throw new Error("Không thể khôi phục cửa hàng vì ID đã tồn tại.");
    }
    const db = getDb();
    db.prepare(`
      INSERT INTO shops (
        id,
        name,
        address,
        address_detail,
        province_code,
        province_name,
        district_name,
        ward_code,
        ward_name,
        phone,
        represent,
        total_money,
        status,
        created_date,
        created_date_display,
        updated_at
      ) VALUES (
        @id,
        @name,
        @address,
        @address_detail,
        @province_code,
        @province_name,
        @district_name,
        @ward_code,
        @ward_name,
        @phone,
        @represent,
        @total_money,
        @status,
        @created_date,
        @created_date_display,
        CURRENT_TIMESTAMP
      )
    `).run({
        id: restoredId,
        name: String(snapshot.name ?? "").trim(),
        address: String(snapshot.address ?? ""),
        address_detail: String(snapshot.address_detail ?? ""),
        province_code: String(snapshot.province_code ?? ""),
        province_name: String(snapshot.province_name ?? ""),
        district_name: String(snapshot.district_name ?? ""),
        ward_code: String(snapshot.ward_code ?? ""),
        ward_name: String(snapshot.ward_name ?? ""),
        phone: String(snapshot.phone ?? ""),
        represent: String(snapshot.represent ?? ""),
        total_money: Number(snapshot.total_money ?? 0),
        status: Number(snapshot.status ?? 1) === 0 ? 0 : 1,
        created_date: String(snapshot.created_date ?? ""),
        created_date_display: String(snapshot.created_date_display ?? "")
    });
    return getShopById(restoredId);
}
function deleteShop(id) {
    const db = getDb();
    return db.prepare("DELETE FROM shops WHERE id = ?").run(id).changes > 0;
}
function deleteShops(ids) {
    const normalizedIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.trunc(id))));
    if (normalizedIds.length === 0) {
        return 0;
    }
    const db = getDb();
    const placeholders = normalizedIds.map(() => "?").join(", ");
    return Number(db.prepare(`DELETE FROM shops WHERE id IN (${placeholders})`).run(...normalizedIds).changes || 0);
}
function updateShopStatus(ids, status) {
    const normalizedIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.trunc(id))));
    if (normalizedIds.length === 0) {
        return 0;
    }
    const db = getDb();
    const placeholders = normalizedIds.map(() => "?").join(", ");
    return Number(db
        .prepare(`
        UPDATE shops
        SET
          status = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${placeholders})
      `)
        .run(status === 0 ? 0 : 1, ...normalizedIds).changes || 0);
}
function getAllShopOptions() {
    const db = getDb();
    const rows = db
        .prepare(`
      SELECT id, name, status
      FROM shops
      WHERE status = 1
      ORDER BY name ASC, id ASC
    `)
        .all();
    return rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name)
    }));
}
