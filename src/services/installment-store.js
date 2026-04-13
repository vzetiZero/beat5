"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importInstallmentsFromExcel = importInstallmentsFromExcel;
exports.listInstallments = listInstallments;
exports.getInstallmentPageBootstrap = getInstallmentPageBootstrap;
exports.formatInstallmentDateForUi = formatInstallmentDateForUi;
exports.getInstallmentById = getInstallmentById;
exports.getInstallmentSnapshotById = getInstallmentSnapshotById;
exports.countLegacyInstallments = countLegacyInstallments;
exports.assignLegacyInstallmentsToShop = assignLegacyInstallmentsToShop;
exports.countInstallmentsByShop = countInstallmentsByShop;
exports.countInstallmentsByInstallerNames = countInstallmentsByInstallerNames;
exports.transferInstallmentsToShop = transferInstallmentsToShop;
exports.transferInstallmentsInstallerNames = transferInstallmentsInstallerNames;
exports.saveInstallment = saveInstallment;
exports.restoreInstallmentFromSnapshot = restoreInstallmentFromSnapshot;
exports.deleteInstallment = deleteInstallment;
exports.deleteInstallments = deleteInstallments;
exports.updateInstallmentStatus = updateInstallmentStatus;
exports.updateInstallmentCollectionProgress = updateInstallmentCollectionProgress;
exports.updateInstallmentNextPaymentDay = updateInstallmentNextPaymentDay;
exports.previewInstallment = previewInstallment;
exports.syncAllInstallmentStatuses = syncAllInstallmentStatuses;
const node_fs_1 = __importDefault(require("node:fs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const XLSX = __importStar(require("xlsx"));
const data_path_1 = require("./data-path");
const shop_store_1 = require("./shop-store");
const DATA_DIR = (0, data_path_1.getDataDir)();
const DB_PATH = (0, data_path_1.getDataFilePath)("installments.sqlite");
const DEFAULT_COLUMN_FIELDS = [
    "stt",
    "loanDate",
    "customerRef",
    "imei",
    "loanPackage",
    "revenue",
    "setupFee",
    "netDisbursement",
    "paidBefore",
    "paymentDay",
    "loanDays",
    "installmentAmount",
    "note",
    "installerName",
    "referralFee",
    "mc",
    "status"
];
const NORMALIZED_DEFAULT_COLUMN_FIELD_MAP = new Map(DEFAULT_COLUMN_FIELDS.map((field) => [normalizeHeader(field), field]));
const IMPORT_MONEY_FIELDS = new Set([
    "loanPackage",
    "revenue",
    "setupFee",
    "netDisbursement",
    "paidBefore",
    "installmentAmount",
    "referralFee"
]);
const IMPORT_FIELD_LABELS = {
    loanPackage: "Gói vay",
    revenue: "Doanh thu",
    setupFee: "Phí cài máy",
    netDisbursement: "Thực chi",
    paidBefore: "Đóng trước",
    installmentAmount: "Tiền đóng",
    referralFee: "HH giới thiệu",
    paymentDay: "Ngày đóng",
    loanDate: "Ngày lên hợp đồng"
};

let dbInstance = null;
function ensureColumn(db, tableName, columnName, columnDefinition) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (columns.some((column) => column.name === columnName)) {
        return;
    }
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
}
function normalizeLegacyPaymentDayValues(db) {
    const rows = db
        .prepare(`
      SELECT id, loan_date, payment_day
      FROM installments
      WHERE payment_day IS NOT NULL
        AND TRIM(CAST(payment_day AS TEXT)) <> ''
    `)
        .all();
    const updateStatement = db.prepare(`
      UPDATE installments
      SET payment_day = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    for (const row of rows) {
        const currentValue = String(row.payment_day ?? "").trim();
        if (!/^\d{1,2}$/.test(currentValue)) {
            continue;
        }
        const resolvedDate = resolveMonthlyPaymentDate(Number(currentValue), String(row.loan_date ?? ""));
        if (!resolvedDate || resolvedDate === currentValue) {
            continue;
        }
        updateStatement.run(resolvedDate, Number(row.id));
    }
}
function inferLegacyCollectionIntervalDays(row) {
    const loanDays = Number(row.loan_days ?? 0);
    if (!Number.isFinite(loanDays) || loanDays <= 0) {
        return 1;
    }
    const currentInterval = Number(row.collection_interval_days ?? 0);
    if (Number.isFinite(currentInterval) && currentInterval > 1 && currentInterval <= 15) {
        return Math.min(loanDays, Math.trunc(currentInterval));
    }
    const installmentAmount = Number(row.installment_amount ?? 0);
    const revenue = Number(row.revenue ?? 0);
    if ((currentInterval <= 0 || currentInterval <= 15) &&
        Number.isFinite(installmentAmount) &&
        installmentAmount > 0 &&
        Number.isFinite(revenue) &&
        revenue > installmentAmount) {
        const inferredPeriods = Math.max(1, Math.round(revenue / installmentAmount));
        const inferredInterval = Math.max(1, Math.round(loanDays / inferredPeriods));
        return Math.min(loanDays, inferredInterval);
    }
    const preferredIntervals = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    for (const interval of preferredIntervals) {
        if (loanDays % interval === 0) {
            return interval;
        }
    }
    const loanDate = String(row.loan_date ?? "").trim();
    const paymentDay = String(row.payment_day ?? "").trim();
    const dayDelta = getDaysBetweenIsoDates(loanDate, paymentDay);
    if (dayDelta !== null && dayDelta > 1 && dayDelta <= 15 && dayDelta <= loanDays) {
        return dayDelta;
    }
    return loanDays;
}
function backfillLegacyCollectionMetadata(db) {
    const rows = db
        .prepare(`
      SELECT
        id,
        loan_date,
        loan_days,
        payment_day,
        revenue,
        paid_before,
        installment_amount,
        collection_interval_days,
        prepaid_period_count,
        payment_method
      FROM installments
    `)
        .all();
    const updateStatement = db.prepare(`
      UPDATE installments
      SET
        payment_method = ?,
        collection_interval_days = ?,
        prepaid_period_count = ?,
        installment_amount = ?,
        payment_day = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const transaction = db.transaction((items) => {
        for (const row of items) {
            const loanDate = String(row.loan_date ?? "").trim();
            const loanDays = Number(row.loan_days ?? 0);
            if (!loanDate || !Number.isFinite(loanDays) || loanDays <= 0) {
                continue;
            }
            const intervalDays = Math.max(1, Math.min(loanDays, inferLegacyCollectionIntervalDays(row)));
            const prepaidPeriodCountCurrent = Number(row.prepaid_period_count ?? 0);
            const schedule = buildCollectionSchedule({
                loanDate,
                loanDays,
                collectionIntervalDays: intervalDays,
                totalRevenue: Number(row.revenue ?? 0),
                prepaidPeriodCount: 0
            });
            if (!schedule.length) {
                continue;
            }
            const paidBefore = Math.max(0, Number(row.paid_before ?? 0));
            let prepaidPeriodCount = Number.isFinite(prepaidPeriodCountCurrent) && prepaidPeriodCountCurrent > 0
                ? Math.trunc(prepaidPeriodCountCurrent)
                : 0;
            if (prepaidPeriodCount <= 0 && paidBefore > 0) {
                let remainingPaidBefore = paidBefore;
                for (const period of schedule) {
                    if (remainingPaidBefore < Number(period.amount || 0)) {
                        break;
                    }
                    remainingPaidBefore -= Number(period.amount || 0);
                    prepaidPeriodCount += 1;
                }
            }
            prepaidPeriodCount = Math.max(0, Math.min(schedule.length, prepaidPeriodCount));
            const recalculatedSchedule = buildCollectionSchedule({
                loanDate,
                loanDays,
                collectionIntervalDays: intervalDays,
                totalRevenue: Number(row.revenue ?? 0),
                prepaidPeriodCount
            });
            const firstUnpaidPeriod = recalculatedSchedule.find((period) => !period.isPrepaid) || null;
            const installmentAmount = Number(recalculatedSchedule[0]?.amount || 0);
            const paymentDay = firstUnpaidPeriod?.dueDate || addDaysToIsoDate(loanDate, loanDays);
            const paymentMethod = intervalDays > 1 ? "periodic" : normalizePaymentMethod(row.payment_method);
            updateStatement.run(paymentMethod, intervalDays, prepaidPeriodCount, installmentAmount, paymentDay, Number(row.id));
        }
    });
    transaction(rows);
}
function getDb() {
    if (dbInstance) {
        return dbInstance;
    }
    node_fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
    const db = new better_sqlite3_1.default(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
    CREATE TABLE IF NOT EXISTS installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stt INTEGER,
      shop_id INTEGER NOT NULL DEFAULT 0,
      shop_name TEXT NOT NULL DEFAULT '',
      loan_date TEXT,
      loan_date_display TEXT NOT NULL DEFAULT '',
      customer_ref TEXT NOT NULL DEFAULT '',
      customer_code TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL DEFAULT '',
      imei TEXT NOT NULL DEFAULT '',
      loan_package INTEGER NOT NULL DEFAULT 0,
      revenue INTEGER NOT NULL DEFAULT 0,
      setup_fee INTEGER NOT NULL DEFAULT 0,
      net_disbursement INTEGER NOT NULL DEFAULT 0,
      paid_before INTEGER NOT NULL DEFAULT 0,
      payment_day INTEGER,
      loan_days INTEGER,
      installment_amount INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      installer_name TEXT NOT NULL DEFAULT '',
      referral_fee INTEGER NOT NULL DEFAULT 0,
      mc TEXT NOT NULL DEFAULT '',
      status_code INTEGER,
      status_text TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT 'daily',
      collection_interval_days INTEGER NOT NULL DEFAULT 1,
      prepaid_period_count INTEGER NOT NULL DEFAULT 0,
      source_row INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS installment_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      shop_id INTEGER NOT NULL DEFAULT 0,
      shop_name TEXT NOT NULL DEFAULT '',
      row_count INTEGER NOT NULL,
      skipped_rows INTEGER NOT NULL DEFAULT 0,
      imported_at TEXT NOT NULL
    );
  `);
    ensureColumn(db, "installments", "shop_id", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn(db, "installments", "shop_name", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, "installments", "updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
    ensureColumn(db, "installments", "payment_method", "TEXT NOT NULL DEFAULT 'daily'");
    ensureColumn(db, "installments", "collection_interval_days", "INTEGER NOT NULL DEFAULT 1");
    ensureColumn(db, "installments", "prepaid_period_count", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn(db, "installments", "collection_progress", "TEXT NOT NULL DEFAULT '[]'");
    ensureColumn(db, "installment_imports", "shop_id", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn(db, "installment_imports", "shop_name", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, "installment_imports", "normalization_logs", "TEXT NOT NULL DEFAULT '[]'");
    normalizeLegacyPaymentDayValues(db);
    backfillLegacyCollectionMetadata(db);
    dbInstance = db;
    return db;
}
function normalizeHeader(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[đĐ]/g, "d")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}
function includesAny(value, patterns) {
    return patterns.some((pattern) => value.includes(pattern));
}
function classifyHeader(header) {
    const normalized = normalizeHeader(header);
    if (!normalized) {
        return null;
    }
    if (NORMALIZED_DEFAULT_COLUMN_FIELD_MAP.has(normalized)) {
        return NORMALIZED_DEFAULT_COLUMN_FIELD_MAP.get(normalized) ?? null;
    }
    if (normalized === "stt") {
        return "stt";
    }
    if (includesAny(normalized, ["tiendong", "tidnddng"])) {
        return "installmentAmount";
    }
    if ((normalized.includes("ngay") || normalized.includes("ngdy")) &&
        (includesAny(normalized, ["dong", "ddng", "trc", "truoc"]) || normalized.endsWith("trc"))) {
        return "paymentDay";
    }
    if ((normalized.startsWith("ngay") || normalized.startsWith("ngdy")) &&
        !includesAny(normalized, ["dong", "ddng"])) {
        return "loanDate";
    }
    if (includesAny(normalized, ["imei"])) {
        return "imei";
    }
    if (includesAny(normalized, ["goivay", "gdivay"])) {
        return "loanPackage";
    }
    if (includesAny(normalized, ["doanhthu"])) {
        return "revenue";
    }
    if (includesAny(normalized, ["phicaimay", "phdcdimdy"]) ||
        (normalized.includes("phicai") && normalized.includes("may"))) {
        return "setupFee";
    }
    if (includesAny(normalized, ["thucchi", "thdcchi"])) {
        return "netDisbursement";
    }
    if (includesAny(normalized, ["dongtruoc", "dongtrc", "ddngtrc"])) {
        return "paidBefore";
    }
    if (includesAny(normalized, ["ngaydong", "ngdyddng"])) {
        return "paymentDay";
    }
    if (includesAny(normalized, ["songay", "sdngdy", "thoihan", "loantime"])) {
        return "loanDays";
    }
    if (normalized === "note" || normalized.includes("ghichu")) {
        return "note";
    }
    if (includesAny(normalized, ["nvcaidat", "nhanviencaidat", "nvcdiddt"])) {
        return "installerName";
    }
    if (includesAny(normalized, ["hhgioith", "hhgioithieu", "hhgidith"])) {
        return "referralFee";
    }
    if (normalized === "mc") {
        return "mc";
    }
    if (normalized.includes("status") || normalized.includes("tinhtrang")) {
        return "status";
    }
    if (includesAny(normalized, ["makh", "khachhang", "tenkh", "makhten", "mdkhtdn"]) ||
        (normalized.includes("kh") && includesAny(normalized, ["ten", "tdn"]))) {
        return "customerRef";
    }
    return null;
}
function parseInteger(value) {
    const parsed = parseNumericValue(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}
function parseNullableInteger(value) {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return null;
    }
    const parsed = parseNumericValue(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
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
    const isNegative = raw.startsWith("-") || (raw.startsWith("(") && raw.endsWith(")"));
    const unsigned = raw.replace(/[()-]/g, "");
    const sanitized = unsigned.replace(/[^0-9.,]/g, "");
    if (!sanitized) {
        return Number.NaN;
    }
    let normalizedNumber = sanitized;
    const dotCount = (sanitized.match(/\./g) || []).length;
    const commaCount = (sanitized.match(/,/g) || []).length;
    if (dotCount > 0 && commaCount > 0) {
        const lastDot = sanitized.lastIndexOf(".");
        const lastComma = sanitized.lastIndexOf(",");
        const decimalSeparator = lastDot > lastComma ? "." : ",";
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
    if (!Number.isFinite(parsed)) {
        return Number.NaN;
    }
    return isNegative ? -parsed : parsed;
}
function formatIsoDate(year, month, day) {
    const monthText = String(month).padStart(2, "0");
    const dayText = String(day).padStart(2, "0");
    return `${year}-${monthText}-${dayText}`;
}
function formatDisplayDate(isoDate) {
    if (!isoDate) {
        return "";
    }
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return isoDate;
    }
    return `${match[3]}/${match[2]}/${match[1]}`;
}
function formatCurrencyForImportLog(value) {
    return `${Number(value || 0).toLocaleString("vi-VN")} ₫`;
}
function pushNormalizationMessage(messages, message) {
    const normalizedMessage = String(message || "").trim();
    if (!normalizedMessage) {
        return;
    }
    if (!messages.includes(normalizedMessage)) {
        messages.push(normalizedMessage);
    }
}
function addDaysToIsoDate(isoDate, daysToAdd) {
    if (!isoDate) {
        return "";
    }
    const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return "";
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return "";
    }
    const baseDate = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(baseDate.getTime())) {
        return "";
    }
    const safeDays = Number.isFinite(Number(daysToAdd)) ? Math.max(0, Math.trunc(Number(daysToAdd))) : 0;
    baseDate.setUTCDate(baseDate.getUTCDate() + safeDays);
    return formatIsoDate(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, baseDate.getUTCDate());
}
function getDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function resolveMonthlyPaymentDate(dayOfMonth, loanDateIso) {
    const loanDateMatch = String(loanDateIso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const normalizedDay = Number(dayOfMonth);
    if (!loanDateMatch || !Number.isInteger(normalizedDay) || normalizedDay < 1 || normalizedDay > 31) {
        return "";
    }
    let year = Number(loanDateMatch[1]);
    let month = Number(loanDateMatch[2]);
    const loanDay = Number(loanDateMatch[3]);
    if (normalizedDay < loanDay) {
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    const day = Math.min(normalizedDay, getDaysInMonth(year, month));
    return formatIsoDate(year, month, day);
}
function getDaysBetweenIsoDates(fromIsoDate, toIsoDate) {
    if (!fromIsoDate || !toIsoDate) {
        return null;
    }
    const fromMatch = fromIsoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const toMatch = toIsoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!fromMatch || !toMatch) {
        return null;
    }
    const fromDate = new Date(Date.UTC(Number(fromMatch[1]), Number(fromMatch[2]) - 1, Number(fromMatch[3])));
    const toDate = new Date(Date.UTC(Number(toMatch[1]), Number(toMatch[2]) - 1, Number(toMatch[3])));
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return null;
    }
    return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}
function isValidDateParts(year, month, day) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return false;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
        return false;
    }
    const candidate = new Date(Date.UTC(year, month - 1, day));
    return (candidate.getUTCFullYear() === year &&
        candidate.getUTCMonth() === month - 1 &&
        candidate.getUTCDate() === day);
}
function toIsoDateIfValid(year, month, day) {
    return isValidDateParts(year, month, day) ? formatIsoDate(year, month, day) : "";
}
function normalizeDateValue(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const isoDate = formatIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
        return { isoDate, displayDate: formatDisplayDate(isoDate) };
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        const parsedDate = XLSX.SSF.parse_date_code(value);
        if (parsedDate) {
            const isoDate = toIsoDateIfValid(parsedDate.y, parsedDate.m, parsedDate.d);
            if (isoDate) {
                return { isoDate, displayDate: formatDisplayDate(isoDate) };
            }
        }
    }
    const raw = String(value ?? "").trim();
    if (!raw) {
        return { isoDate: "", displayDate: "" };
    }
    if (/^\d{5,}$/.test(raw)) {
        const asNumber = Number(raw);
        if (Number.isFinite(asNumber)) {
            const parsedDate = XLSX.SSF.parse_date_code(asNumber);
            if (parsedDate) {
                const isoDate = toIsoDateIfValid(parsedDate.y, parsedDate.m, parsedDate.d);
                if (isoDate) {
                    return { isoDate, displayDate: formatDisplayDate(isoDate) };
                }
            }
        }
    }
    const dateToken = raw
        .replace(/[T\s].*$/, "")
        .replace(/\./g, "/")
        .replace(/-/g, "/")
        .replace(/\\+/g, "/")
        .replace(/\/+/g, "/");
    const ddmmyyyyMatch = dateToken.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
        const isoDate = toIsoDateIfValid(Number(ddmmyyyyMatch[3]), Number(ddmmyyyyMatch[2]), Number(ddmmyyyyMatch[1]));
        if (isoDate) {
            return { isoDate, displayDate: formatDisplayDate(isoDate) };
        }
    }
    const isoMatch = dateToken.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (isoMatch) {
        const isoDate = toIsoDateIfValid(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
        if (isoDate) {
            return { isoDate, displayDate: formatDisplayDate(isoDate) };
        }
    }
    const parsedFallback = new Date(raw);
    if (!Number.isNaN(parsedFallback.getTime())) {
        const isoDate = toIsoDateIfValid(parsedFallback.getFullYear(), parsedFallback.getMonth() + 1, parsedFallback.getDate());
        if (isoDate) {
            return { isoDate, displayDate: formatDisplayDate(isoDate) };
        }
    }
    return { isoDate: "", displayDate: raw };
}
function splitCustomerReference(value) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
        return { customerCode: "", customerName: "" };
    }
    const match = normalized.match(/^(\d+)\s+(.*)$/);
    if (match) {
        return {
            customerCode: match[1],
            customerName: match[2].trim()
        };
    }
    return {
        customerCode: "",
        customerName: normalized
    };
}

function normalizePaymentMethod(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (normalized === "periodic" || normalized === "theoky") {
        return "periodic";
    }
    return "daily";
}

function parseBooleanValue(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

function buildCollectionSchedule({ loanDate, loanDays, collectionIntervalDays, totalRevenue, prepaidPeriodCount }) {
    if (!loanDate || !Number.isFinite(loanDays) || loanDays <= 0) {
        return [];
    }
    const safeLoanDays = Math.max(1, Math.trunc(loanDays));
    const safeIntervalDays = Number.isFinite(collectionIntervalDays) && collectionIntervalDays > 0
        ? Math.min(Math.trunc(collectionIntervalDays), safeLoanDays)
        : safeLoanDays;
    const totalPeriods = Math.max(1, Math.ceil(safeLoanDays / safeIntervalDays));
    const safeRevenue = Math.max(0, Math.trunc(totalRevenue || 0));
    const baseAmount = Math.floor(safeRevenue / totalPeriods);
    const remainder = safeRevenue - baseAmount * totalPeriods;
    const safePrepaidPeriodCount = Math.max(0, Math.min(totalPeriods, Math.trunc(prepaidPeriodCount || 0)));
    const schedule = [];

    for (let index = 0; index < totalPeriods; index += 1) {
        const periodEndDay = Math.min(safeLoanDays, (index + 1) * safeIntervalDays);
        schedule.push({
            periodIndex: index + 1,
            dueDate: addDaysToIsoDate(loanDate, periodEndDay),
            amount: baseAmount + (index < remainder ? 1 : 0),
            isPrepaid: index < safePrepaidPeriodCount,
            coveredDays: index === totalPeriods - 1 ? safeLoanDays - safeIntervalDays * index : safeIntervalDays
        });
    }

    return schedule;
}
function getInstallmentCollectionState(row, loanDate, loanDays) {
    const numericLoanDays = loanDays === null || loanDays === undefined ? Number.NaN : Number(loanDays);
    if (!loanDate || !Number.isFinite(numericLoanDays) || numericLoanDays <= 0) {
        return {
            nextDueDate: "",
            finalDueDate: "",
            dueInDays: null,
            dueStatus: "",
            paidPeriodsCount: 0,
            totalPeriods: 0,
            isFullyPaid: false,
            finalDueInDays: null
        };
    }
    const schedule = buildCollectionSchedule({
        loanDate,
        loanDays: numericLoanDays,
        collectionIntervalDays: Number(row.collection_interval_days ?? 1),
        totalRevenue: Number(row.revenue ?? 0),
        prepaidPeriodCount: 0
    });
    const finalDueDate = addDaysToIsoDate(loanDate, numericLoanDays);
    if (schedule.length === 0) {
        return {
            nextDueDate: "",
            finalDueDate,
            dueInDays: null,
            dueStatus: "",
            paidPeriodsCount: 0,
            totalPeriods: 0,
            isFullyPaid: false,
            finalDueInDays: finalDueDate ? getDaysBetweenIsoDates(new Date().toISOString().slice(0, 10), finalDueDate) : null
        };
    }
    const storedProgress = parseCollectionProgress(row.collection_progress);
    const paidProgressSet = new Set(storedProgress);
    if (paidProgressSet.size === 0) {
        let remainingPaidBefore = Math.max(0, Number(row.paid_before ?? 0));
        for (const period of schedule) {
            const periodAmount = Number(period.amount || 0);
            if (remainingPaidBefore < periodAmount) {
                break;
            }
            remainingPaidBefore -= periodAmount;
            paidProgressSet.add(Number(period.periodIndex));
        }
    }
    const nextUnpaidPeriod = schedule.find((period) => !paidProgressSet.has(Number(period.periodIndex))) || null;
    const explicitPaymentDay = mapPaymentDayValue(row.payment_day, loanDate).paymentDay;
    const nextDueDate = explicitPaymentDay || nextUnpaidPeriod?.dueDate || "";
    const todayIsoDate = new Date().toISOString().slice(0, 10);
    const dueInDays = nextDueDate ? getDaysBetweenIsoDates(todayIsoDate, nextDueDate) : null;
    const finalDueInDays = finalDueDate ? getDaysBetweenIsoDates(todayIsoDate, finalDueDate) : null;
    const paidPeriodsCount = paidProgressSet.size;
    const totalPeriods = schedule.length;
    const isFullyPaid = totalPeriods > 0 && paidPeriodsCount >= totalPeriods;
    let dueStatus = "";
    if (dueInDays !== null) {
        if (dueInDays < 0) {
            dueStatus = "overdue";
        }
        else if (dueInDays === 0) {
            dueStatus = "due_today";
        }
        else if (dueInDays <= 3) {
            dueStatus = "due_soon";
        }
    }
    return {
        nextDueDate,
        finalDueDate,
        dueInDays,
        dueStatus,
        paidPeriodsCount,
        totalPeriods,
        isFullyPaid,
        finalDueInDays
    };
}

function resolveInstallmentDisplayStatus(collectionState) {
    if (collectionState.isFullyPaid) {
        return "Đã đóng";
    }
    if (collectionState.finalDueInDays !== null && collectionState.finalDueInDays < 0) {
        return "Quá hạn";
    }
    if (collectionState.dueInDays === 0) {
        return "Đến ngày trả góp";
    }
    if (collectionState.dueInDays === 1) {
        return "Ngày mai đến ngày";
    }
    if (collectionState.paidPeriodsCount <= 0) {
        return "Chậm trả góp";
    }
    if (collectionState.dueInDays !== null && collectionState.dueInDays < 0) {
        return "Chậm trả góp";
    }
    return "Đang vay";
}

function normalizePaymentDateValue(value, loanDateIso, normalizationMessages) {
    const raw = String(value ?? "").trim();
    if (!raw) {
        return { value: null, displayDate: "" };
    }
    if (/^\d{1,2}$/.test(raw)) {
        const resolvedDate = resolveMonthlyPaymentDate(Number(raw), loanDateIso);
        if (resolvedDate) {
            pushNormalizationMessage(normalizationMessages ?? [], `${IMPORT_FIELD_LABELS.paymentDay} ${raw} được suy luận thành ${formatDisplayDate(resolvedDate)} dựa trên ${IMPORT_FIELD_LABELS.loanDate.toLowerCase()}.`);
            return { value: resolvedDate, displayDate: formatDisplayDate(resolvedDate) };
        }
        return { value: raw, displayDate: raw };
    }
    const normalized = normalizeDateValue(value);
    if (!normalized.isoDate) {
        throw new Error("Ngày đóng không hợp lệ.");
    }
    return { value: normalized.isoDate, displayDate: normalized.displayDate };
}
function mapPaymentDayValue(value, loanDateIso) {
    if (value === null || value === undefined) {
        return { paymentDay: null, paymentDayDisplay: "" };
    }
    const raw = String(value).trim();
    if (!raw) {
        return { paymentDay: null, paymentDayDisplay: "" };
    }
    if (/^\d{1,2}$/.test(raw)) {
        const resolvedDate = resolveMonthlyPaymentDate(Number(raw), loanDateIso);
        return resolvedDate
            ? { paymentDay: resolvedDate, paymentDayDisplay: formatDisplayDate(resolvedDate) }
            : { paymentDay: raw, paymentDayDisplay: raw };
    }
    const normalized = normalizeDateValue(raw);
    if (normalized.isoDate) {
        return { paymentDay: normalized.isoDate, paymentDayDisplay: normalized.displayDate };
    }
    return { paymentDay: raw, paymentDayDisplay: raw };
}
function normalizeInstallmentInput(input) {
    const customerRef = String(input.customerRef ?? "").replace(/\s+/g, " ").trim();
    const imei = String(input.imei ?? "").replace(/\s+/g, "").trim();
    const shopId = parseNullableInteger(input.shopId);
    if (!customerRef && !imei) {
        throw new Error("Cần nhập ít nhất Mã KH - Tên hoặc IMEI.");
    }
    if (!shopId || shopId <= 0) {
        throw new Error("Vui lòng chọn cửa hàng cho hợp đồng trả góp.");
    }
    const shop = (0, shop_store_1.getShopById)(shopId);
    if (!shop) {
        throw new Error("Cửa hàng được chọn không hợp lệ.");
    }
    const { isoDate, displayDate } = normalizeDateValue(input.loanDate);
    if (!isoDate) {
        throw new Error("Ngày vay không hợp lệ. Hãy nhập theo dạng ngày/tháng/năm hoặc năm-tháng-ngày.");
    }
    const { customerCode, customerName } = splitCustomerReference(customerRef);
    const statusText = String(input.statusText ?? "").trim();
    const statusCode = parseNullableInteger(input.statusCode);
    const paymentMethod = normalizePaymentMethod(input.paymentMethod);

    if (input.collectionIntervalDays !== undefined && input.collectionIntervalDays !== null && String(input.collectionIntervalDays).trim() !== "") {
        const loanDays = parseNullableInteger(input.loanDays);
        const collectionIntervalDays = parseNullableInteger(input.collectionIntervalDays);
        const revenue = parseInteger(input.revenue);
        const loanPackage = parseInteger(input.loanPackage);

        if (!customerRef) {
            throw new Error("Vui lòng nhập tên khách hàng.");
        }
        if (!loanDays || loanDays <= 0) {
            throw new Error("Thời gian vay phải lớn hơn 0 ngày.");
        }
        if (!collectionIntervalDays || collectionIntervalDays <= 0) {
            throw new Error("Số ngày đóng tiền phải lớn hơn 0.");
        }
        if (revenue <= 0) {
            throw new Error("Trả góp phải lớn hơn 0 VNĐ.");
        }
        if (loanPackage <= 0) {
            throw new Error("Tiền đưa khách phải lớn hơn 0 VNĐ.");
        }
        if (loanPackage >= revenue) {
            throw new Error("Tiền đưa khách phải nhỏ hơn Trả Góp.");
        }

        const safeIntervalDays = Math.min(collectionIntervalDays, loanDays);
        const prepaidPeriodCount = parseBooleanValue(input.collectInAdvance) ? 1 : parseNullableInteger(input.prepaidPeriodCount) || 0;
        const schedule = buildCollectionSchedule({
            loanDate: isoDate,
            loanDays,
            collectionIntervalDays: safeIntervalDays,
            totalRevenue: revenue,
            prepaidPeriodCount
        });
        const installmentAmount = schedule.length > 0 ? schedule[0].amount : 0;
        const paidBefore = schedule
            .filter((period) => period.isPrepaid)
            .reduce((total, period) => total + Number(period.amount || 0), 0);
        const firstUnpaidPeriod = schedule.find((period) => !period.isPrepaid) || null;
        const paymentDate = normalizePaymentDateValue(input.paymentDay, isoDate);

        return {
            stt: parseNullableInteger(input.stt),
            shopId: shop.id,
            shopName: shop.name,
            loanDate: isoDate,
            loanDateDisplay: displayDate,
            customerRef,
            customerCode,
            customerName,
            imei,
            loanPackage,
            revenue,
            setupFee: parseInteger(input.setupFee),
            netDisbursement: parseInteger(input.netDisbursement) || loanPackage,
            paidBefore,
            paymentDay: paymentDate.value || (firstUnpaidPeriod ? firstUnpaidPeriod.dueDate : null),
            loanDays,
            installmentAmount,
            note: String(input.note ?? "").trim(),
            installerName: String(input.installerName ?? "").trim(),
            referralFee: parseInteger(input.referralFee),
            mc: String(input.mc ?? "").trim(),
            statusCode,
            statusText: statusText || (statusCode !== null ? `Trạng thái ${statusCode}` : ""),
            paymentMethod,
            collectionIntervalDays: safeIntervalDays,
            prepaidPeriodCount
        };
    }

    const paymentDate = normalizePaymentDateValue(input.paymentDay, isoDate);
    const directLoanPackage = parseInteger(input.loanPackage);
    const directRevenue = parseInteger(input.revenue);
    if (directRevenue <= 0) {
        throw new Error("Trả góp phải lớn hơn 0 VNĐ.");
    }
    if (directLoanPackage <= 0) {
        throw new Error("Tiền đưa khách phải lớn hơn 0 VNĐ.");
    }
    if (directLoanPackage >= directRevenue) {
        throw new Error("Tiền đưa khách phải nhỏ hơn Trả Góp.");
    }
    return {
        stt: parseNullableInteger(input.stt),
        shopId: shop.id,
        shopName: shop.name,
        loanDate: isoDate,
        loanDateDisplay: displayDate,
        customerRef,
        customerCode,
        customerName,
        imei,
        loanPackage: directLoanPackage,
        revenue: directRevenue,
        setupFee: parseInteger(input.setupFee),
        netDisbursement: parseInteger(input.netDisbursement),
        paidBefore: parseInteger(input.paidBefore),
        paymentDay: paymentDate.value,
        loanDays: parseNullableInteger(input.loanDays),
        installmentAmount: parseInteger(input.installmentAmount),
        note: String(input.note ?? "").trim(),
        installerName: String(input.installerName ?? "").trim(),
        referralFee: parseInteger(input.referralFee),
        mc: String(input.mc ?? "").trim(),
        statusCode,
        statusText: statusText || (statusCode !== null ? `Trạng thái ${statusCode}` : ""),
        paymentMethod,
        collectionIntervalDays: parseNullableInteger(input.collectionIntervalDays) || 1,
        prepaidPeriodCount: parseNullableInteger(input.prepaidPeriodCount) || 0
    };
}
function toImportRecord(mappedValues, rowNumber, normalizationMessages) {
    const customerRef = String(mappedValues.customerRef ?? "").replace(/\s+/g, " ").trim();
    const imei = String(mappedValues.imei ?? "").trim();
    if (!customerRef && !imei) {
        return null;
    }
    const { isoDate, displayDate } = normalizeDateValue(mappedValues.loanDate);
    const paymentDate = normalizePaymentDateValue(mappedValues.paymentDay, isoDate, normalizationMessages);
    const { customerCode, customerName } = splitCustomerReference(customerRef);
    const statusRaw = String(mappedValues.status ?? "").trim();
    const statusCode = statusRaw && /^-?\d+$/.test(statusRaw.replace(/\s+/g, "")) ? parseInteger(statusRaw) : null;
    return {
        stt: parseNullableInteger(mappedValues.stt),
        shopId: 0,
        shopName: "",
        loanDate: isoDate,
        loanDateDisplay: displayDate,
        customerRef,
        customerCode,
        customerName,
        imei: imei.replace(/\s+/g, ""),
        loanPackage: parseInteger(mappedValues.loanPackage),
        revenue: parseInteger(mappedValues.revenue),
        setupFee: parseInteger(mappedValues.setupFee),
        netDisbursement: parseInteger(mappedValues.netDisbursement),
        paidBefore: parseInteger(mappedValues.paidBefore),
        paymentDay: paymentDate.value,
        loanDays: parseNullableInteger(mappedValues.loanDays),
        installmentAmount: parseInteger(mappedValues.installmentAmount),
        note: String(mappedValues.note ?? "").trim(),
        installerName: String(mappedValues.installerName ?? "").trim(),
        referralFee: parseInteger(mappedValues.referralFee),
        mc: String(mappedValues.mc ?? "").trim(),
        statusCode,
        statusText: statusRaw,
        paymentMethod: "daily",
        collectionIntervalDays: 1,
        prepaidPeriodCount: 0,
        sourceRow: rowNumber
    };
}
function toImportRecordFromCells(row, columnFields, rowNumber, shopId, shopName) {
    const mappedValues = {};
    const normalizationMessages = [];
    row.forEach((value, index) => {
        const field = columnFields[index];
        if (field) {
            mappedValues[field] = value;
        }
    });
    const record = toImportRecord(mappedValues, rowNumber, normalizationMessages);
    if (!record) {
        return null;
    }
    return {
        record: {
            ...record,
            shopId,
            shopName
        },
        mappedValues,
        normalizationMessages
    };
}
function rawMoneyValueLooksLikeThousandUnit(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Number.isInteger(value) && Math.abs(value) > 0 && Math.abs(value) < 100000;
    }
    const raw = String(value ?? "").trim();
    if (!raw || /[₫đd]|vnđ|vnd/gi.test(raw) || /[.,]/.test(raw) || !/^-?\d+$/.test(raw)) {
        return false;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && Math.abs(parsed) > 0 && Math.abs(parsed) < 100000;
}
function detectImportMoneyMultiplier(dataRows, columnFields) {
    let numericMoneyCellCount = 0;
    let thousandUnitCellCount = 0;
    for (const row of dataRows.slice(0, 200)) {
        if (!Array.isArray(row)) {
            continue;
        }
        row.forEach((value, index) => {
            const field = columnFields[index];
            if (!field || !IMPORT_MONEY_FIELDS.has(field)) {
                return;
            }
            const parsed = parseNumericValue(value);
            if (!Number.isFinite(parsed) || parsed === 0) {
                return;
            }
            numericMoneyCellCount += 1;
            if (rawMoneyValueLooksLikeThousandUnit(value)) {
                thousandUnitCellCount += 1;
            }
        });
    }
    if (numericMoneyCellCount < 3) {
        return 1;
    }
    return thousandUnitCellCount / numericMoneyCellCount >= 0.6 ? 1000 : 1;
}
function applyImportMoneyMultiplier(importRow, multiplier) {
    if (!importRow) {
        return importRow;
    }
    if (multiplier === 1) {
        return importRow;
    }
    const nextRecord = { ...importRow.record };
    for (const field of IMPORT_MONEY_FIELDS) {
        const rawValue = importRow.mappedValues[field];
        const currentValue = Number(nextRecord[field] || 0);
        if (rawMoneyValueLooksLikeThousandUnit(rawValue) && currentValue !== 0) {
            pushNormalizationMessage(importRow.normalizationMessages, `${IMPORT_FIELD_LABELS[field]} ${String(rawValue).trim()} được quy đổi thành ${formatCurrencyForImportLog(Math.round(currentValue * multiplier))}.`);
        }
        nextRecord[field] = Math.round(Number(nextRecord[field] || 0) * multiplier);
    }
    return {
        ...importRow,
        record: nextRecord
    };
}
function buildImportNormalizationLogs(importRows) {
    return importRows
        .filter((item) => item && Array.isArray(item.normalizationMessages) && item.normalizationMessages.length > 0)
        .map((item) => ({
        rowNumber: Number(item.record?.sourceRow || 0),
        messages: item.normalizationMessages.slice()
    }));
}
function parseNormalizationLogs(value) {
    if (!value) {
        return [];
    }
    try {
        const parsed = JSON.parse(String(value));
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .map((item) => ({
            rowNumber: Number(item?.rowNumber || 0),
            messages: Array.isArray(item?.messages)
                ? item.messages.map((message) => String(message || "").trim()).filter(Boolean)
                : []
        }))
            .filter((item) => item.rowNumber > 0 && item.messages.length > 0);
    }
    catch (_error) {
        return [];
    }
}
function parseCollectionProgress(value) {
    if (!value) {
        return [];
    }
    try {
        const parsed = JSON.parse(String(value));
        if (!Array.isArray(parsed)) {
            return [];
        }
        return Array.from(new Set(parsed
            .map((item) => Number(item))
            .filter((item) => Number.isFinite(item) && item > 0)
            .map((item) => Math.trunc(item)))).sort((a, b) => a - b);
    }
    catch (_error) {
        return [];
    }
}
function mapInstallmentRow(row) {
    const loanDate = String(row.loan_date ?? "");
    const loanDays = row.loan_days === null || row.loan_days === undefined ? null : Number(row.loan_days);
    const collectionState = getInstallmentCollectionState(row, loanDate, loanDays);
    const paymentDate = collectionState.nextDueDate
        ? { paymentDay: collectionState.nextDueDate, paymentDayDisplay: formatDisplayDate(collectionState.nextDueDate) }
        : mapPaymentDayValue(row.payment_day, loanDate);
    const dueDate = collectionState.finalDueDate;
    const dueInDays = collectionState.dueInDays;
    const dueStatus = collectionState.dueStatus;
    const statusText = resolveInstallmentDisplayStatus(collectionState);
    const statusCode = statusText === "Đã đóng" ? 1 : statusText === "Quá hạn" ? 2 : 0;
    return {
        id: Number(row.id),
        stt: row.stt === null || row.stt === undefined ? null : Number(row.stt),
        shopId: Number(row.shop_id ?? 0),
        shopName: String(row.shop_name ?? ""),
        loanDate,
        loanDateDisplay: String(row.loan_date_display ?? ""),
        customerRef: String(row.customer_ref ?? ""),
        customerCode: String(row.customer_code ?? ""),
        customerName: String(row.customer_name ?? ""),
        imei: String(row.imei ?? ""),
        loanPackage: Number(row.loan_package ?? 0),
        revenue: Number(row.revenue ?? 0),
        setupFee: Number(row.setup_fee ?? 0),
        netDisbursement: Number(row.net_disbursement ?? 0),
        paidBefore: Number(row.paid_before ?? 0),
        paymentDay: paymentDate.paymentDay,
        paymentDayDisplay: paymentDate.paymentDayDisplay,
        loanDays,
        dueDate,
        dueDateDisplay: dueDate ? formatDisplayDate(dueDate) : "",
        dueInDays,
        dueStatus,
        installmentAmount: Number(row.installment_amount ?? 0),
        note: String(row.note ?? ""),
        installerName: String(row.installer_name ?? ""),
        referralFee: Number(row.referral_fee ?? 0),
        mc: String(row.mc ?? ""),
        statusCode,
        statusText,
        paymentMethod: normalizePaymentMethod(row.payment_method),
        collectionIntervalDays: Number(row.collection_interval_days ?? 1),
        prepaidPeriodCount: Number(row.prepaid_period_count ?? 0),
        collectionProgress: parseCollectionProgress(row.collection_progress),
        createdAt: String(row.created_at ?? ""),
        updatedAt: String(row.updated_at ?? "")
    };
}
function getShopAllocatedLoanPackage(shopId, excludeInstallmentId) {
    const normalizedShopId = Number(shopId);
    if (!Number.isFinite(normalizedShopId) || normalizedShopId <= 0) {
        return 0;
    }
    const excludedId = Number(excludeInstallmentId || 0);
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        id,
        stt,
        shop_id,
        shop_name,
        loan_date,
        loan_date_display,
        customer_ref,
        customer_code,
        customer_name,
        imei,
        loan_package,
        revenue,
        setup_fee,
        net_disbursement,
        paid_before,
        payment_day,
        loan_days,
        installment_amount,
        note,
        installer_name,
        referral_fee,
        mc,
        status_code,
        status_text,
        payment_method,
        collection_interval_days,
        prepaid_period_count,
        collection_progress,
        created_at,
        updated_at
      FROM installments
      WHERE shop_id = ?
        AND (? <= 0 OR id <> ?)
    `).all(normalizedShopId, excludedId, excludedId);
    return rows
        .map(mapInstallmentRow)
        .filter((item) => item.statusText !== "Đã đóng")
        .reduce((total, item) => total + Number(item.loanPackage || 0), 0);
}
function getDefaultInstallmentPriority(item) {
    const statusText = String(item?.statusText || "").trim();
    if (statusText === "Đến ngày trả góp") {
        return 0;
    }
    if (statusText === "Ngày mai đến ngày") {
        return 1;
    }
    if (statusText === "Quá hạn") {
        return 2;
    }
    return 3;
}
function getInstallmentStatusKey(value) {
    return String(value || "")
        .trim()
        .normalize("NFD")
        .replace(/[đĐ]/g, "d")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
function normalizeStatusComparisonText(value) {
    return String(value || "").trim().normalize("NFC");
}
function sanitizeFilters(filters) {
    const page = Math.max(1, Number(filters.page || 1));
    const perPage = Math.min(200, Math.max(10, Number(filters.perPage || 50)));
    const sortDirection = filters.sortDirection === "asc" ? "asc" : "desc";
    const dueStatus = String(filters.dueStatus || "").trim().toLowerCase();
    return {
        generalSearch: String(filters.generalSearch || "").trim(),
        status: typeof filters.status === "number" ? filters.status : null,
        statusKey: String(filters.statusKey || "").trim(),
        statusText: String(filters.statusText || "").trim(),
        fromDate: String(filters.fromDate || "").trim(),
        toDate: String(filters.toDate || "").trim(),
        loanTime: typeof filters.loanTime === "number" ? filters.loanTime : null,
        dueStatus: dueStatus === "due_today" || dueStatus === "due_soon" || dueStatus === "overdue" || dueStatus === "calendar_due" || dueStatus === "due_tomorrow" ? dueStatus : "",
        searchShopId: typeof filters.searchShopId === "number" ? filters.searchShopId : null,
        page,
        perPage,
        sortColumn: String(filters.sortColumn || "loanDate"),
        sortDirection,
        allowedShopIds: Array.isArray(filters.allowedShopIds) ? filters.allowedShopIds : undefined
    };
}
function toBindingArray(source) {
    return source;
}
function importInstallmentsFromExcel(buffer, fileName, shopId, shopName) {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error("File Excel không có sheet dữ liệu.");
    }
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: true
    });
    const [headerRow = [], ...dataRows] = rows;
    const columnFields = headerRow.map((header) => classifyHeader(header));
    const recognizedColumnCount = columnFields.filter((field) => Boolean(field)).length;
    if (recognizedColumnCount === 0) {
        throw new Error("Không nhận diện được cột hợp lệ trong file Excel. Vui lòng dùng đúng tiêu đề cột của hệ thống.");
    }
    const moneyMultiplier = detectImportMoneyMultiplier(dataRows, columnFields);
    const importRows = dataRows
        .map((row, index) => applyImportMoneyMultiplier(toImportRecordFromCells(Array.isArray(row) ? row : [], columnFields, index + 2, shopId, shopName), moneyMultiplier))
        .filter((record) => Boolean(record));
    const records = importRows.map((item) => item.record);
    if (records.length === 0) {
        throw new Error("Không tìm thấy dòng dữ liệu hợp lệ trong file Excel.");
    }
    const normalizationLogs = buildImportNormalizationLogs(importRows);
    const importedAt = new Date().toISOString();
    const db = getDb();
    const insertRow = db.prepare(`
      INSERT INTO installments (
      stt,
      shop_id,
      shop_name,
      loan_date,
      loan_date_display,
      customer_ref,
      customer_code,
      customer_name,
      imei,
      loan_package,
      revenue,
      setup_fee,
      net_disbursement,
      paid_before,
      payment_day,
      loan_days,
      installment_amount,
      note,
      installer_name,
      referral_fee,
      mc,
      status_code,
      status_text,
      payment_method,
      collection_interval_days,
      prepaid_period_count,
      source_row,
      updated_at
    ) VALUES (
      @stt,
      @shopId,
      @shopName,
      @loanDate,
      @loanDateDisplay,
      @customerRef,
      @customerCode,
      @customerName,
      @imei,
      @loanPackage,
      @revenue,
      @setupFee,
      @netDisbursement,
      @paidBefore,
      @paymentDay,
      @loanDays,
      @installmentAmount,
      @note,
      @installerName,
      @referralFee,
      @mc,
      @statusCode,
      @statusText,
      @paymentMethod,
      @collectionIntervalDays,
      @prepaidPeriodCount,
      @sourceRow,
      CURRENT_TIMESTAMP
    )
  `);
    const insertImport = db.prepare(`
    INSERT INTO installment_imports (file_name, sheet_name, shop_id, shop_name, row_count, skipped_rows, imported_at, normalization_logs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const transaction = db.transaction(() => {
        for (const record of records) {
            insertRow.run(record);
        }
        insertImport.run(fileName, sheetName, shopId, shopName, records.length, dataRows.length - records.length, importedAt, JSON.stringify(normalizationLogs));
    });
    transaction();
    return {
        fileName,
        sheetName,
        importedRows: records.length,
        skippedRows: dataRows.length - records.length,
        importedAt,
        shopId,
        shopName,
        normalizationLogs
    };
}
function listInstallments(filters) {
    const db = getDb();
    const sanitized = sanitizeFilters(filters);
    const todayIsoDate = new Date().toISOString().slice(0, 10);
    const whereClauses = [];
    const bindings = [];
    if (sanitized.generalSearch) {
        const keyword = `%${sanitized.generalSearch.toLowerCase()}%`;
        whereClauses.push(`(
      LOWER(customer_ref) LIKE ?
      OR LOWER(customer_code) LIKE ?
      OR LOWER(customer_name) LIKE ?
      OR LOWER(imei) LIKE ?
      OR LOWER(note) LIKE ?
      OR LOWER(installer_name) LIKE ?
      OR LOWER(mc) LIKE ?
    )`);
        bindings.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
    }
    if (sanitized.status !== null && Number.isFinite(sanitized.status) && sanitized.status !== 0) {
        whereClauses.push("status_code = ?");
        bindings.push(sanitized.status);
    }
    if (sanitized.fromDate) {
        whereClauses.push("loan_date >= ?");
        bindings.push(sanitized.fromDate);
    }
    if (sanitized.toDate) {
        whereClauses.push("loan_date <= ?");
        bindings.push(sanitized.toDate);
    }
    if (sanitized.loanTime !== null && Number.isFinite(sanitized.loanTime) && sanitized.loanTime !== 0) {
        whereClauses.push("loan_days = ?");
        bindings.push(sanitized.loanTime);
    }
    if (sanitized.searchShopId !== null && Number.isFinite(sanitized.searchShopId) && sanitized.searchShopId !== 0) {
        whereClauses.push("shop_id = ?");
        bindings.push(sanitized.searchShopId);
    }
    if (sanitized.allowedShopIds && sanitized.allowedShopIds.length > 0) {
        const placeholders = sanitized.allowedShopIds.map(() => "?").join(", ");
        whereClauses.push(`shop_id IN (${placeholders})`);
        bindings.push(...sanitized.allowedShopIds);
    }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const allowedSortColumns = {
        stt: "COALESCE(stt, 0)",
        loanDate: "COALESCE(loan_date, '')",
        customerRef: "customer_ref",
        imei: "imei",
        loanPackage: "loan_package",
        revenue: "revenue",
        setupFee: "setup_fee",
        netDisbursement: "net_disbursement",
        paidBefore: "paid_before",
        paymentDay: "COALESCE(payment_day, 0)",
        loanDays: "COALESCE(loan_days, 0)",
        installmentAmount: "installment_amount",
        note: "note",
        installerName: "installer_name",
        referralFee: "referral_fee",
        mc: "mc"
    };
    const sortColumn = allowedSortColumns[sanitized.sortColumn] ? sanitized.sortColumn : "loanDate";
    const orderBySql = `${allowedSortColumns[sortColumn]} ${sanitized.sortDirection.toUpperCase()}, id DESC`;
    const rows = db
        .prepare(`
      SELECT
        id,
        stt,
        shop_id,
        shop_name,
        loan_date,
        loan_date_display,
        customer_ref,
        customer_code,
        customer_name,
        imei,
        loan_package,
        revenue,
        setup_fee,
        net_disbursement,
        paid_before,
        payment_day,
        loan_days,
        installment_amount,
        note,
        installer_name,
        referral_fee,
        mc,
        status_code,
        status_text,
        payment_method,
        collection_interval_days,
        prepaid_period_count,
        collection_progress,
        created_at,
        updated_at
      FROM installments
      ${whereSql}
      ORDER BY ${orderBySql}
    `)
        .all(...toBindingArray(bindings));
    const availableStatuses = db
        .prepare(`
        SELECT DISTINCT status_code, status_text
        FROM installments
        ${whereSql ? `${whereSql} AND` : "WHERE"} (status_code IS NOT NULL OR TRIM(status_text) <> '')
        ORDER BY status_code ASC, status_text ASC
      `)
        .all(...toBindingArray(bindings)).map((item) => ({
        code: item.status_code ?? 0,
        label: item.status_text || `Trạng thái ${item.status_code ?? 0}`
    }));
    const lastImportRow = db
        .prepare(`
      SELECT file_name, shop_name, row_count, imported_at, normalization_logs
      FROM installment_imports
      ${sanitized.searchShopId !== null && sanitized.searchShopId !== 0
        ? "WHERE shop_id = ?"
        : sanitized.allowedShopIds && sanitized.allowedShopIds.length > 0
            ? `WHERE shop_id IN (${sanitized.allowedShopIds.map(() => "?").join(", ")})`
            : ""}
      ORDER BY id DESC
      LIMIT 1
    `)
        .get(...(sanitized.searchShopId !== null && sanitized.searchShopId !== 0
        ? [sanitized.searchShopId]
        : sanitized.allowedShopIds && sanitized.allowedShopIds.length > 0
            ? sanitized.allowedShopIds
            : []));
    const dashboardRow = db
        .prepare(`
      SELECT
        COUNT(*) AS totalContracts,
        COALESCE(SUM(loan_package), 0) AS totalLoanPackage,
        COALESCE(SUM(revenue), 0) AS totalRevenue,
        COALESCE(SUM(net_disbursement), 0) AS totalNetDisbursement,
        COALESCE(SUM(paid_before), 0) AS totalPaidBefore,
        COALESCE(SUM(installment_amount), 0) AS totalInstallmentAmount,
        COALESCE(AVG(CASE WHEN loan_days IS NOT NULL AND loan_days > 0 THEN loan_days END), 0) AS averageLoanDays,
        COALESCE(SUM(CASE WHEN loan_date = ? THEN 1 ELSE 0 END), 0) AS contractsTodayCount,
        COALESCE(SUM(CASE
          WHEN loan_date IS NOT NULL
            AND TRIM(loan_date) <> ''
            AND loan_days IS NOT NULL
            AND loan_days > 0
            AND date(loan_date, '+' || loan_days || ' day') = ?
          THEN 1 ELSE 0 END), 0) AS dueTodayCount,
        COALESCE(SUM(CASE
          WHEN loan_date IS NOT NULL
            AND TRIM(loan_date) <> ''
            AND loan_days IS NOT NULL
            AND loan_days > 0
            AND date(loan_date, '+' || loan_days || ' day') > ?
            AND date(loan_date, '+' || loan_days || ' day') <= date(?, '+3 day')
          THEN 1 ELSE 0 END), 0) AS dueSoonCount,
        COALESCE(SUM(CASE
          WHEN loan_date IS NOT NULL
            AND TRIM(loan_date) <> ''
            AND loan_days IS NOT NULL
            AND loan_days > 0
            AND date(loan_date, '+' || loan_days || ' day') < ?
          THEN 1 ELSE 0 END), 0) AS overdueCount
      FROM installments
      ${whereSql}
    `)
        .get(...toBindingArray([todayIsoDate, todayIsoDate, todayIsoDate, todayIsoDate, todayIsoDate, ...bindings]));
    const statusSummary = db
        .prepare(`
        SELECT
          status_code,
          status_text,
          COUNT(*) AS count
        FROM installments
        ${whereSql}
        GROUP BY status_code, status_text
        ORDER BY count DESC, status_code ASC
      `)
        .all(...toBindingArray(bindings)).map((row) => ({
        statusCode: row.status_code === null || row.status_code === undefined ? null : Number(row.status_code),
        statusText: String(row.status_text || "Chưa đặt trạng thái"),
        count: Number(row.count || 0)
    }));
    const allItems = rows.map(mapInstallmentRow);
    const filteredItems = (sanitized.dueStatus
        ? sanitized.dueStatus === "calendar_due"
            ? allItems.filter((item) => item.statusText === "Quá hạn" || item.statusText === "Chậm trả góp")
            : sanitized.dueStatus === "due_tomorrow"
                ? allItems.filter((item) => Number(item.dueInDays) === 1)
                : allItems.filter((item) => item.dueStatus === sanitized.dueStatus)
        : allItems)
        .filter((item) => !sanitized.statusKey || getInstallmentStatusKey(item.statusText) === sanitized.statusKey)
        .filter((item) => !sanitized.statusText || normalizeStatusComparisonText(item.statusText) === normalizeStatusComparisonText(sanitized.statusText));
    const prioritizedItems = sortColumn === "loanDate" && sanitized.sortDirection === "desc"
        ? filteredItems
            .map((item, index) => ({ item, index }))
            .sort((left, right) => getDefaultInstallmentPriority(left.item) - getDefaultInstallmentPriority(right.item) || left.index - right.index)
            .map((entry) => entry.item)
        : filteredItems;
    const offset = (sanitized.page - 1) * sanitized.perPage;
    const items = prioritizedItems.slice(offset, offset + sanitized.perPage);
    const availableLoanDays = Array.from(new Set(prioritizedItems
        .map((item) => item.loanDays)
        .filter((value) => value !== null && Number.isFinite(value) && value > 0)))
        .sort((left, right) => Number(left) - Number(right));
    const visibleStatuses = Array.from(new Map(prioritizedItems
        .filter((item) => item.statusCode !== null || String(item.statusText || "").trim())
        .map((item) => {
        const key = `${item.statusCode ?? 0}::${String(item.statusText || "").trim()}`;
        return [key, {
                code: item.statusCode ?? 0,
                label: item.statusText || `Trang thai ${item.statusCode ?? 0}`,
                value: getInstallmentStatusKey(item.statusText || `Trang thai ${item.statusCode ?? 0}`)
            }];
    })).values());
    const recalculatedStatusSummaryMap = new Map();
    prioritizedItems.forEach((item) => {
        const statusCode = item.statusCode === null || item.statusCode === undefined ? null : Number(item.statusCode);
        const statusText = String(item.statusText || "Chua dat trang thai");
        const key = `${statusCode ?? "null"}::${statusText}`;
        const current = recalculatedStatusSummaryMap.get(key) || {
            statusCode,
            statusText,
            count: 0
        };
        current.count += 1;
        recalculatedStatusSummaryMap.set(key, current);
    });
    const recalculatedStatusSummary = Array.from(recalculatedStatusSummaryMap.values()).sort((left, right) => right.count - left.count || Number(left.statusCode ?? 0) - Number(right.statusCode ?? 0));
    const summary = prioritizedItems.reduce((accumulator, item) => {
        accumulator.count += 1;
        accumulator.totalRevenue += Number(item.revenue || 0);
        accumulator.totalNetDisbursement += Number(item.netDisbursement || 0);
        accumulator.totalPaidBefore += Number(item.paidBefore || 0);
        accumulator.totalInstallmentAmount += Number(item.installmentAmount || 0);
        return accumulator;
    }, {
        count: 0,
        totalRevenue: 0,
        totalNetDisbursement: 0,
        totalPaidBefore: 0,
        totalInstallmentAmount: 0
    });
    const dashboardShopIds = sanitized.searchShopId !== null && sanitized.searchShopId > 0
        ? [sanitized.searchShopId]
        : sanitized.allowedShopIds && sanitized.allowedShopIds.length > 0
            ? sanitized.allowedShopIds
            : undefined;
    const shopSummary = (0, shop_store_1.listShops)({
        allowedIds: dashboardShopIds,
        page: 1,
        perPage: 10
    });
    const dashboard = prioritizedItems.reduce((accumulator, item) => {
        accumulator.totalContracts += 1;
        accumulator.totalLoanPackage += Number(item.loanPackage || 0);
        accumulator.totalRevenue += Number(item.revenue || 0);
        accumulator.totalNetDisbursement += Number(item.netDisbursement || 0);
        accumulator.totalPaidBefore += Number(item.paidBefore || 0);
        accumulator.totalInstallmentAmount += Number(item.installmentAmount || 0);
        if (Number.isFinite(Number(item.loanDays)) && Number(item.loanDays) > 0) {
            accumulator.loanDaysTotal += Number(item.loanDays);
            accumulator.loanDaysCount += 1;
        }
        if (item.loanDate === todayIsoDate) {
            accumulator.contractsTodayCount += 1;
        }
        if (item.dueStatus === "due_today") {
            accumulator.dueTodayCount += 1;
        }
        else if (item.dueStatus === "due_soon") {
            accumulator.dueSoonCount += 1;
        }
        else if (item.dueStatus === "overdue") {
            accumulator.overdueCount += 1;
        }
        return accumulator;
    }, {
        totalContracts: 0,
        totalLoanPackage: 0,
        totalRevenue: 0,
        totalNetDisbursement: 0,
        totalPaidBefore: 0,
        totalInstallmentAmount: 0,
        loanDaysTotal: 0,
        loanDaysCount: 0,
        contractsTodayCount: 0,
        dueTodayCount: 0,
        dueSoonCount: 0,
        overdueCount: 0
    });
    return {
        items,
        total: prioritizedItems.length,
        page: sanitized.page,
        perPage: sanitized.perPage,
        totalPages: Math.max(1, Math.ceil(prioritizedItems.length / sanitized.perPage)),
        sortColumn,
        sortDirection: sanitized.sortDirection,
        availableLoanDays,
        availableStatuses: visibleStatuses,
        summary,
        dashboard: {
            totalContracts: dashboard.totalContracts,
            totalLoanPackage: dashboard.totalLoanPackage,
            totalRevenue: dashboard.totalRevenue,
            totalNetDisbursement: dashboard.totalNetDisbursement,
            totalShopInvestment: Number(shopSummary.summary?.totalMoney || 0),
            totalPaidBefore: dashboard.totalPaidBefore,
            totalInstallmentAmount: dashboard.totalInstallmentAmount,
            averageLoanDays: dashboard.loanDaysCount > 0 ? dashboard.loanDaysTotal / dashboard.loanDaysCount : 0,
            contractsTodayCount: dashboard.contractsTodayCount,
            dueTodayCount: dashboard.dueTodayCount,
            dueSoonCount: dashboard.dueSoonCount,
            overdueCount: dashboard.overdueCount
        },
        statusSummary: recalculatedStatusSummary,
        lastImport: lastImportRow
            ? {
                fileName: lastImportRow.file_name,
                shopName: lastImportRow.shop_name,
                rowCount: Number(lastImportRow.row_count || 0),
                importedAt: lastImportRow.imported_at,
                normalizationLogs: parseNormalizationLogs(lastImportRow.normalization_logs)
            }
            : null
    };
}
function getInstallmentPageBootstrap() {
    const result = listInstallments({});
    return {
        availableLoanDays: result.availableLoanDays,
        availableStatuses: result.availableStatuses,
        statusSummary: result.statusSummary,
        dashboard: result.dashboard,
        lastImport: result.lastImport
    };
}
function previewInstallment(input) {
    const normalized = normalizeInstallmentInput(input);
    const loanDays = Number(normalized.loanDays || 0);
    const collectionIntervalDays = Number(normalized.collectionIntervalDays || 1);
    const schedule = buildCollectionSchedule({
        loanDate: normalized.loanDate,
        loanDays,
        collectionIntervalDays,
        totalRevenue: Number(normalized.revenue || 0),
        prepaidPeriodCount: Number(normalized.prepaidPeriodCount || 0)
    });
    const firstUnpaidPeriod = schedule.find((period) => !period.isPrepaid) || schedule[0] || null;
    const lastPeriod = schedule[schedule.length - 1] || null;
    return {
        normalized,
        schedule,
        summary: {
            nextStt: normalized.stt ?? getNextInstallmentStt(),
            totalPeriods: schedule.length,
            collectionIntervalDays,
            loanDays,
            loanPackage: Number(normalized.loanPackage || 0),
            revenue: Number(normalized.revenue || 0),
            totalInterest: Math.max(0, Number(normalized.revenue || 0) - Number(normalized.loanPackage || 0)),
            installmentAmount: Number(normalized.installmentAmount || 0),
            paidBefore: Number(normalized.paidBefore || 0),
            firstPaymentDay: firstUnpaidPeriod?.dueDate || normalized.paymentDay || "",
            firstPaymentDayDisplay: firstUnpaidPeriod?.dueDate ? formatDisplayDate(firstUnpaidPeriod.dueDate) : formatInstallmentDateForUi(normalized.paymentDay),
            finalDueDate: lastPeriod?.dueDate || (normalized.loanDate && loanDays > 0 ? addDaysToIsoDate(normalized.loanDate, loanDays) : ""),
            finalDueDateDisplay: lastPeriod?.dueDate
                ? formatDisplayDate(lastPeriod.dueDate)
                : (normalized.loanDate && loanDays > 0 ? formatDisplayDate(addDaysToIsoDate(normalized.loanDate, loanDays)) : ""),
            prepaidPeriodCount: Number(normalized.prepaidPeriodCount || 0)
        }
    };
}
function syncAllInstallmentStatuses() {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        id,
        stt,
        shop_id,
        shop_name,
        loan_date,
        loan_date_display,
        customer_ref,
        customer_code,
        customer_name,
        imei,
        loan_package,
        revenue,
        setup_fee,
        net_disbursement,
        paid_before,
        payment_day,
        loan_days,
        installment_amount,
        note,
        installer_name,
        referral_fee,
        mc,
        status_code,
        status_text,
        payment_method,
        collection_interval_days,
        prepaid_period_count,
        collection_progress,
        created_at,
        updated_at
      FROM installments
    `).all();
    const updateStatement = db.prepare(`
      UPDATE installments
      SET
        status_code = ?,
        status_text = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const runSync = db.transaction((items) => {
        let updatedCount = 0;
        for (const row of items) {
            const mapped = mapInstallmentRow(row);
            const currentStatusCode = row.status_code === null || row.status_code === undefined ? null : Number(row.status_code);
            const currentStatusText = String(row.status_text ?? "").trim();
            const nextStatusCode = mapped.statusCode === null || mapped.statusCode === undefined ? null : Number(mapped.statusCode);
            const nextStatusText = String(mapped.statusText || "").trim();
            if (currentStatusCode === nextStatusCode && currentStatusText === nextStatusText) {
                continue;
            }
            updateStatement.run(nextStatusCode, nextStatusText, Number(row.id));
            updatedCount += 1;
        }
        return updatedCount;
    });
    const updatedCount = runSync(rows);
    return {
        total: rows.length,
        updated: updatedCount
    };
}
function persistResolvedInstallmentStatus(id) {
    const installmentId = Number(id);
    if (!Number.isFinite(installmentId) || installmentId <= 0) {
        throw new Error("ID hợp đồng không hợp lệ.");
    }
    const db = getDb();
    const row = db.prepare(`
      SELECT
        id,
        stt,
        shop_id,
        shop_name,
        loan_date,
        loan_date_display,
        customer_ref,
        customer_code,
        customer_name,
        imei,
        loan_package,
        revenue,
        setup_fee,
        net_disbursement,
        paid_before,
        payment_day,
        loan_days,
        installment_amount,
        note,
        installer_name,
        referral_fee,
        mc,
        status_code,
        status_text,
        payment_method,
        collection_interval_days,
        prepaid_period_count,
        collection_progress,
        created_at,
        updated_at
      FROM installments
      WHERE id = ?
    `).get(installmentId);
    if (!row) {
        throw new Error("Không tìm thấy hợp đồng trả góp.");
    }
    const mapped = mapInstallmentRow(row);
    db.prepare(`
      UPDATE installments
      SET
        status_code = ?,
        status_text = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(mapped.statusCode, mapped.statusText, installmentId);
    return getInstallmentById(installmentId);
}
function formatInstallmentDateForUi(value) {
    return value ? formatDisplayDate(value) : "";
}
function getInstallmentById(id) {
    const db = getDb();
    const row = db
        .prepare(`
      SELECT
        id,
        stt,
        shop_id,
        shop_name,
        loan_date,
        loan_date_display,
        customer_ref,
        customer_code,
        customer_name,
        imei,
        loan_package,
        revenue,
        setup_fee,
        net_disbursement,
        paid_before,
        payment_day,
        loan_days,
        installment_amount,
        note,
        installer_name,
        referral_fee,
        mc,
        status_code,
        status_text,
        payment_method,
        collection_interval_days,
        prepaid_period_count,
        collection_progress,
        created_at,
        updated_at
      FROM installments
      WHERE id = ?
    `)
        .get(id);
    return row ? mapInstallmentRow(row) : null;
}
function getInstallmentSnapshotById(id) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM installments WHERE id = ?").get(id);
    return row || null;
}
function countLegacyInstallments() {
    const db = getDb();
    const row = db
        .prepare(`
      SELECT COUNT(*) AS total
      FROM installments
      WHERE shop_id <= 0 OR TRIM(shop_name) = ''
    `)
        .get();
    return Number(row?.total || 0);
}
function assignLegacyInstallmentsToShop(shopId, shopName) {
    if (!Number.isFinite(shopId) || shopId <= 0) {
        return 0;
    }
    const normalizedShopName = String(shopName || "").trim();
    if (!normalizedShopName) {
        return 0;
    }
    const db = getDb();
    const runAssignment = db.transaction(() => {
        const installmentResult = db
            .prepare(`
        UPDATE installments
        SET
          shop_id = ?,
          shop_name = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE shop_id <= 0 OR TRIM(shop_name) = ''
      `)
            .run(shopId, normalizedShopName);
        db.prepare(`
      UPDATE installment_imports
      SET
        shop_id = ?,
        shop_name = ?
      WHERE shop_id <= 0 OR TRIM(shop_name) = ''
    `).run(shopId, normalizedShopName);
        return Number(installmentResult.changes || 0);
    });
    return runAssignment();
}
function countInstallmentsByShop(shopId) {
    if (!Number.isFinite(shopId) || shopId <= 0) {
        return 0;
    }
    const db = getDb();
    const row = db
        .prepare(`
      SELECT COUNT(*) AS total
      FROM installments
      WHERE shop_id = ?
    `)
        .get(shopId);
    return Number(row?.total || 0);
}
function normalizeInstallerNames(names) {
    if (!Array.isArray(names)) {
        return [];
    }
    return Array.from(new Set(names
        .map((name) => String(name ?? "").trim())
        .filter(Boolean)));
}
function countInstallmentsByInstallerNames(names) {
    const normalizedNames = normalizeInstallerNames(names);
    if (normalizedNames.length === 0) {
        return 0;
    }
    const db = getDb();
    const placeholders = normalizedNames.map(() => "?").join(", ");
    const row = db
        .prepare(`
      SELECT COUNT(*) AS total
      FROM installments
      WHERE TRIM(installer_name) IN (${placeholders})
    `)
        .get(...normalizedNames);
    return Number(row?.total || 0);
}
function transferInstallmentsToShop(sourceShopId, targetShopId, targetShopName) {
    if (!Number.isFinite(sourceShopId) || sourceShopId <= 0) {
        return 0;
    }
    if (!Number.isFinite(targetShopId) || targetShopId <= 0 || sourceShopId === targetShopId) {
        return 0;
    }
    const normalizedTargetName = String(targetShopName || "").trim();
    if (!normalizedTargetName) {
        return 0;
    }
    const db = getDb();
    const runTransfer = db.transaction(() => {
        const installmentResult = db
            .prepare(`
        UPDATE installments
        SET
          shop_id = ?,
          shop_name = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = ?
      `)
            .run(targetShopId, normalizedTargetName, sourceShopId);
        db.prepare(`
      UPDATE installment_imports
      SET
        shop_id = ?,
        shop_name = ?
      WHERE shop_id = ?
    `).run(targetShopId, normalizedTargetName, sourceShopId);
        return Number(installmentResult.changes || 0);
    });
    return runTransfer();
}
function transferInstallmentsInstallerNames(sourceInstallerNames, targetInstallerName) {
    const normalizedNames = normalizeInstallerNames(sourceInstallerNames);
    const normalizedTargetName = String(targetInstallerName || "").trim();
    if (normalizedNames.length === 0 || !normalizedTargetName) {
        return 0;
    }
    const db = getDb();
    const placeholders = normalizedNames.map(() => "?").join(", ");
    const result = db
        .prepare(`
      UPDATE installments
      SET
        installer_name = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE TRIM(installer_name) IN (${placeholders})
    `)
        .run(normalizedTargetName, ...normalizedNames);
    return Number(result.changes || 0);
}
function getNextInstallmentStt() {
    const db = getDb();
    const row = db
        .prepare(`
      SELECT COALESCE(MAX(stt), 0) AS maxStt
      FROM installments
    `)
        .get();
    return Number(row?.maxStt || 0) + 1;
}
function saveInstallment(input, installmentId) {
    const db = getDb();
    const normalized = normalizeInstallmentInput(input);
    const allocatedLoanPackage = getShopAllocatedLoanPackage(normalized.shopId, installmentId);
    const nextAllocatedLoanPackage = allocatedLoanPackage + Number(normalized.loanPackage || 0);
    const shop = (0, shop_store_1.getShopById)(normalized.shopId);
    const shopInvestment = Number(shop?.totalMoney || 0);
    if (nextAllocatedLoanPackage > shopInvestment) {
        const availableAmount = Math.max(0, shopInvestment - allocatedLoanPackage);
        throw new Error(`Vốn của cửa hàng không đủ. Shop hiện có ${shopInvestment.toLocaleString("vi-VN")} VNĐ, đang cho vay ${allocatedLoanPackage.toLocaleString("vi-VN")} VNĐ, còn có thể cho vay ${availableAmount.toLocaleString("vi-VN")} VNĐ.`);
    }
    if (installmentId) {
        const existing = getInstallmentById(installmentId);
        if (!existing) {
            throw new Error("Không tìm thấy bản ghi trả góp để cập nhật.");
        }
        const updateStatement = db.prepare(`
      UPDATE installments
      SET
        stt = @stt,
        shop_id = @shopId,
        shop_name = @shopName,
        loan_date = @loanDate,
        loan_date_display = @loanDateDisplay,
        customer_ref = @customerRef,
        customer_code = @customerCode,
        customer_name = @customerName,
        imei = @imei,
        loan_package = @loanPackage,
        revenue = @revenue,
        setup_fee = @setupFee,
        net_disbursement = @netDisbursement,
        paid_before = @paidBefore,
        payment_day = @paymentDay,
        loan_days = @loanDays,
        installment_amount = @installmentAmount,
        note = @note,
        installer_name = @installerName,
        referral_fee = @referralFee,
        mc = @mc,
        status_code = @statusCode,
        status_text = @statusText,
        payment_method = @paymentMethod,
        collection_interval_days = @collectionIntervalDays,
        prepaid_period_count = @prepaidPeriodCount,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
        const result = updateStatement.run({
            ...normalized,
            stt: normalized.stt ?? existing.stt ?? null,
            id: installmentId
        });
        if (result.changes === 0) {
            throw new Error("Không tìm thấy bản ghi trả góp để cập nhật.");
        }
        return persistResolvedInstallmentStatus(installmentId);
    }
    const insertStatement = db.prepare(`
    INSERT INTO installments (
      stt,
      shop_id,
      shop_name,
      loan_date,
      loan_date_display,
      customer_ref,
      customer_code,
      customer_name,
      imei,
      loan_package,
      revenue,
      setup_fee,
      net_disbursement,
      paid_before,
      payment_day,
      loan_days,
      installment_amount,
      note,
      installer_name,
      referral_fee,
      mc,
      status_code,
      status_text,
      payment_method,
      collection_interval_days,
      prepaid_period_count,
      source_row,
      updated_at
    ) VALUES (
      @stt,
      @shopId,
      @shopName,
      @loanDate,
      @loanDateDisplay,
      @customerRef,
      @customerCode,
      @customerName,
      @imei,
      @loanPackage,
      @revenue,
      @setupFee,
      @netDisbursement,
      @paidBefore,
      @paymentDay,
      @loanDays,
      @installmentAmount,
      @note,
      @installerName,
      @referralFee,
      @mc,
      @statusCode,
      @statusText,
      @paymentMethod,
      @collectionIntervalDays,
      @prepaidPeriodCount,
      0,
      CURRENT_TIMESTAMP
    )
  `);
    const result = insertStatement.run({
        ...normalized,
        stt: normalized.stt ?? getNextInstallmentStt()
    });
    return persistResolvedInstallmentStatus(Number(result.lastInsertRowid));
}
function restoreInstallmentFromSnapshot(snapshot) {
    const restoredId = Number(snapshot?.id || 0);
    if (!Number.isFinite(restoredId) || restoredId <= 0) {
        throw new Error("Du lieu tra gop trong thung rac khong hop le.");
    }
    if (getInstallmentSnapshotById(restoredId)) {
        throw new Error("Không thể khôi phục hợp đồng trả góp vì ID đã tồn tại.");
    }
    const db = getDb();
    db.prepare(`
      INSERT INTO installments (
        id,
        stt,
        shop_id,
        shop_name,
        loan_date,
        loan_date_display,
        customer_ref,
        customer_code,
        customer_name,
        imei,
        loan_package,
        revenue,
        setup_fee,
        net_disbursement,
        paid_before,
        payment_day,
        loan_days,
        installment_amount,
        note,
        installer_name,
        referral_fee,
        mc,
        status_code,
        status_text,
        payment_method,
        collection_interval_days,
        prepaid_period_count,
        source_row,
        created_at,
        updated_at
      ) VALUES (
        @id,
        @stt,
        @shop_id,
        @shop_name,
        @loan_date,
        @loan_date_display,
        @customer_ref,
        @customer_code,
        @customer_name,
        @imei,
        @loan_package,
        @revenue,
        @setup_fee,
        @net_disbursement,
        @paid_before,
        @payment_day,
        @loan_days,
        @installment_amount,
        @note,
        @installer_name,
        @referral_fee,
        @mc,
        @status_code,
        @status_text,
        @payment_method,
        @collection_interval_days,
        @prepaid_period_count,
        @source_row,
        @created_at,
        CURRENT_TIMESTAMP
      )
    `).run({
        id: restoredId,
        stt: snapshot.stt === null || snapshot.stt === undefined ? null : Number(snapshot.stt),
        shop_id: Number(snapshot.shop_id ?? 0),
        shop_name: String(snapshot.shop_name ?? ""),
        loan_date: String(snapshot.loan_date ?? ""),
        loan_date_display: String(snapshot.loan_date_display ?? ""),
        customer_ref: String(snapshot.customer_ref ?? ""),
        customer_code: String(snapshot.customer_code ?? ""),
        customer_name: String(snapshot.customer_name ?? ""),
        imei: String(snapshot.imei ?? ""),
        loan_package: Number(snapshot.loan_package ?? 0),
        revenue: Number(snapshot.revenue ?? 0),
        setup_fee: Number(snapshot.setup_fee ?? 0),
        net_disbursement: Number(snapshot.net_disbursement ?? 0),
        paid_before: Number(snapshot.paid_before ?? 0),
        payment_day: snapshot.payment_day === null || snapshot.payment_day === undefined ? null : String(snapshot.payment_day),
        loan_days: snapshot.loan_days === null || snapshot.loan_days === undefined ? null : Number(snapshot.loan_days),
        installment_amount: Number(snapshot.installment_amount ?? 0),
        note: String(snapshot.note ?? ""),
        installer_name: String(snapshot.installer_name ?? ""),
        referral_fee: Number(snapshot.referral_fee ?? 0),
        mc: String(snapshot.mc ?? ""),
        status_code: snapshot.status_code === null || snapshot.status_code === undefined ? null : Number(snapshot.status_code),
        status_text: String(snapshot.status_text ?? ""),
        payment_method: String(snapshot.payment_method ?? "daily"),
        collection_interval_days: Number(snapshot.collection_interval_days ?? 1),
        prepaid_period_count: Number(snapshot.prepaid_period_count ?? 0),
        source_row: Number(snapshot.source_row ?? 0),
        created_at: String(snapshot.created_at ?? new Date().toISOString())
    });
    return getInstallmentById(restoredId);
}
function deleteInstallment(id) {
    const db = getDb();
    const result = db.prepare("DELETE FROM installments WHERE id = ?").run(id);
    return result.changes > 0;
}
function deleteInstallments(ids) {
    const normalizedIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.trunc(id))));
    if (normalizedIds.length === 0) {
        return 0;
    }
    const db = getDb();
    const placeholders = normalizedIds.map(() => "?").join(", ");
    const result = db.prepare(`DELETE FROM installments WHERE id IN (${placeholders})`).run(...normalizedIds);
    return Number(result.changes || 0);
}
function updateInstallmentStatus(ids, statusCode, statusText) {
    const normalizedIds = Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.trunc(id))));
    if (normalizedIds.length === 0) {
        return 0;
    }
    const normalizedStatusText = String(statusText || "").trim() || (statusCode !== null ? `Trang thai ${statusCode}` : "");
    const db = getDb();
    const placeholders = normalizedIds.map(() => "?").join(", ");
    const result = db
        .prepare(`
      UPDATE installments
      SET
        status_code = ?,
        status_text = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `)
        .run(statusCode, normalizedStatusText, ...normalizedIds);
    return Number(result.changes || 0);
}
function updateInstallmentCollectionProgress(id, paidPeriodIndices) {
    const installmentId = Number(id);
    if (!Number.isFinite(installmentId) || installmentId <= 0) {
        throw new Error("ID hợp đồng không hợp lệ.");
    }
    const installment = getInstallmentById(installmentId);
    if (!installment) {
        throw new Error("Không tìm thấy hợp đồng trả góp.");
    }
    const schedule = buildCollectionSchedule({
        loanDate: installment.loanDate,
        loanDays: Number(installment.loanDays ?? 0),
        collectionIntervalDays: Number(installment.collectionIntervalDays ?? 1),
        totalRevenue: Number(installment.revenue ?? 0),
        prepaidPeriodCount: 0
    });
    if (schedule.length === 0) {
        throw new Error("Không thể tạo lịch đóng cho hợp đồng này.");
    }
    const selectedProgress = Array.from(new Set((Array.isArray(paidPeriodIndices) ? paidPeriodIndices : [])
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0 && item <= schedule.length)
        .map((item) => Math.trunc(item)))).sort((a, b) => a - b);
    const normalizedProgress = [];
    for (let periodIndex = 1; periodIndex <= schedule.length; periodIndex += 1) {
        if (!selectedProgress.includes(periodIndex)) {
            break;
        }
        normalizedProgress.push(periodIndex);
    }
    const progressSet = new Set(normalizedProgress);
    const paidBefore = schedule.reduce((total, period) => total + (progressSet.has(period.periodIndex) ? Number(period.amount || 0) : 0), 0);
    let prepaidPeriodCount = 0;
    for (const period of schedule) {
        if (!progressSet.has(period.periodIndex)) {
            break;
        }
        prepaidPeriodCount += 1;
    }
    const firstUnpaidPeriod = schedule.find((period) => !progressSet.has(period.periodIndex)) || null;
    const nextPaymentDay = firstUnpaidPeriod?.dueDate || addDaysToIsoDate(installment.loanDate, Number(installment.loanDays ?? 0));
    const allPeriodsPaid = normalizedProgress.length === schedule.length;
    const currentStatusText = String(installment.statusText || "").trim();
    const normalizedCurrentStatusText = currentStatusText.toLowerCase();
    const isClosedStatus = normalizedCurrentStatusText === "đã hoàn tất"
        || normalizedCurrentStatusText === "da hoan tat"
        || normalizedCurrentStatusText === "đã đóng"
        || normalizedCurrentStatusText === "da dong";
    const nextStatusText = allPeriodsPaid
        ? "Đã đóng"
        : isClosedStatus
            ? "Đang vay"
            : currentStatusText;
    const nextStatusCode = allPeriodsPaid ? 1 : installment.statusCode;
    const db = getDb();
    const result = db.prepare(`
      UPDATE installments
      SET
        paid_before = ?,
        payment_day = ?,
        prepaid_period_count = ?,
        collection_progress = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(paidBefore, nextPaymentDay, prepaidPeriodCount, JSON.stringify(normalizedProgress), installmentId);
    if (Number(result.changes || 0) === 0) {
        throw new Error("Không thể cập nhật tiến độ đóng tiền.");
    }
    return persistResolvedInstallmentStatus(installmentId);
}
function updateInstallmentNextPaymentDay(id, nextPaymentDay) {
    const installmentId = Number(id);
    if (!Number.isFinite(installmentId) || installmentId <= 0) {
        throw new Error("ID hợp đồng không hợp lệ.");
    }
    const installment = getInstallmentById(installmentId);
    if (!installment) {
        throw new Error("Không tìm thấy hợp đồng trả góp.");
    }
    const normalizedPaymentDate = normalizePaymentDateValue(nextPaymentDay, installment.loanDate);
    if (!normalizedPaymentDate.value) {
        throw new Error("Ngày đóng tiếp theo không hợp lệ.");
    }
    const db = getDb();
    const result = db
        .prepare(`
      UPDATE installments
      SET
        payment_day = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
        .run(normalizedPaymentDate.value, installmentId);
    if (Number(result.changes || 0) === 0) {
        throw new Error("Không thể cập nhật ngày đóng tiếp theo.");
    }
    return getInstallmentById(installmentId);
}
