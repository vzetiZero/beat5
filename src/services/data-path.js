"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDataDir = getDataDir;
exports.getDataFilePath = getDataFilePath;
const node_path_1 = __importDefault(require("node:path"));
const ROOT_DIR = node_path_1.default.resolve(__dirname, "..", "..");
function getDataDir() {
    const customDataDir = String(process.env.APP_DATA_DIR || "").trim();
    return customDataDir ? node_path_1.default.resolve(customDataDir) : node_path_1.default.join(ROOT_DIR, "data");
}
function getDataFilePath(fileName) {
    return node_path_1.default.join(getDataDir(), fileName);
}
