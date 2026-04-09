"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passthroughMvcRoutes = exports.remoteModulePages = void 0;
exports.remoteModulePages = [
    { pathname: "/Installment/Index/", title: "Trả góp" },
    { pathname: "/Installment/Create", title: "Tạo hợp đồng trả góp" },
    { pathname: "/Installment/PaymentSchedule", title: "Lịch thanh toán trả góp" },
    { pathname: "/Installment/CloseInstallment", title: "Đóng trả góp" },
    { pathname: "/Installment/GraveInstallment", title: "Đảo họ" },
    { pathname: "/Shop/Index/", title: "Cửa hàng" },
    { pathname: "/Shop/Create", title: "Tạo hoặc cập nhật cửa hàng" },
    { pathname: "/Staff/Index/", title: "Nhân viên" },
    { pathname: "/Staff/Create", title: "Tạo hoặc cập nhật nhân viên" },
    { pathname: "/Staff/PermissionStaff/", title: "Phân quyền", adminOnly: true }
];
exports.passthroughMvcRoutes = [
    "/Shop/ChangeShop",
    "/Print/PrintInstallment",
    "/Print/InstallmentReceipts"
];
