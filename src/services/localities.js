"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProvinceOptions = listProvinceOptions;
exports.getProvinceByCode = getProvinceByCode;
exports.listWardOptionsByProvinceCode = listWardOptionsByProvinceCode;
exports.getWardByCode = getWardByCode;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
let cache = null;
function normalizeText(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase();
}
function compareByName(left, right) {
    return normalizeText(left.name).localeCompare(normalizeText(right.name), "vi");
}
function loadJsonFile(filePath) {
    return JSON.parse(node_fs_1.default.readFileSync(filePath, "utf8"));
}
function resolveDataDir(rootDir) {
    const candidateDirs = [
        node_path_1.default.join(rootDir, "data", "localities"),
        node_path_1.default.join(rootDir, "node_modules", "vn-provinces-wards", "dist", "json_data"),
        node_path_1.default.join(rootDir, "node_modules", "vn-provinces-wards", "src", "json_data")
    ];
    for (const candidateDir of candidateDirs) {
        const provincesPath = node_path_1.default.join(candidateDir, "provinces.json");
        const wardsPath = node_path_1.default.join(candidateDir, "wards.json");
        if (node_fs_1.default.existsSync(provincesPath) && node_fs_1.default.existsSync(wardsPath)) {
            return candidateDir;
        }
    }
    throw new Error("Không tìm thấy bộ dữ liệu địa giới Việt Nam. Cần có provinces.json và wards.json trong data/localities hoặc package vn-provinces-wards.");
}
function buildCache() {
    const rootDir = node_path_1.default.resolve(__dirname, "..", "..");
    const dataDir = resolveDataDir(rootDir);
    const provinceRows = loadJsonFile(node_path_1.default.join(dataDir, "provinces.json"));
    const wardRows = loadJsonFile(node_path_1.default.join(dataDir, "wards.json"));
    const provinces = provinceRows
        .map((row) => ({
        code: String(row.code),
        name: String(row.name),
        unit: String(row.unit || "")
    }))
        .sort(compareByName);
    const provincesByCode = new Map(provinces.map((province) => [province.code, province]));
    const wardsByProvinceCode = new Map();
    for (const row of wardRows) {
        const ward = {
            code: String(row.code),
            name: String(row.name),
            unit: String(row.unit || ""),
            provinceCode: String(row.province_code),
            provinceName: String(row.province_name || ""),
            fullName: String(row.full_name || "")
        };
        const provinceWards = wardsByProvinceCode.get(ward.provinceCode) || [];
        provinceWards.push(ward);
        wardsByProvinceCode.set(ward.provinceCode, provinceWards);
    }
    for (const [, provinceWards] of wardsByProvinceCode) {
        provinceWards.sort(compareByName);
    }
    return {
        provinces,
        provincesByCode,
        wardsByProvinceCode
    };
}
function getCache() {
    if (!cache) {
        cache = buildCache();
    }
    return cache;
}
function listProvinceOptions() {
    return getCache().provinces;
}
function getProvinceByCode(code) {
    return getCache().provincesByCode.get(String(code ?? "").trim()) || null;
}
function listWardOptionsByProvinceCode(provinceCode) {
    const normalizedCode = String(provinceCode ?? "").trim();
    return getCache().wardsByProvinceCode.get(normalizedCode) || [];
}
function getWardByCode(provinceCode, wardCode) {
    const normalizedWardCode = String(wardCode ?? "").trim();
    return (listWardOptionsByProvinceCode(provinceCode).find((ward) => ward.code === normalizedWardCode) || null);
}
