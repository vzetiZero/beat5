"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.users = void 0;
exports.findUserByUsername = findUserByUsername;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const plainUsers = [
    {
        id: "1",
        username: "admin",
        displayName: "Quản trị hệ thống",
        role: "admin",
        password: "Admin@123"
    },
    {
        id: "2",
        username: "staff",
        displayName: "Nhân viên cửa hàng",
        role: "staff",
        password: "Staff@123"
    }
];
exports.users = plainUsers.map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    passwordHash: bcryptjs_1.default.hashSync(user.password, 10)
}));
function findUserByUsername(username) {
    return exports.users.find((user) => user.username.toLowerCase() === username.toLowerCase());
}
