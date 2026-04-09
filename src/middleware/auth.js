"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachViewState = attachViewState;
exports.hasModulePermission = hasModulePermission;
exports.getAllowedShopIds = getAllowedShopIds;
exports.canAccessShop = canAccessShop;
exports.requireModulePermission = requireModulePermission;
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const online_user_store_1 = require("../services/online-user-store");
const shop_store_1 = require("../services/shop-store");
function attachViewState(req, res, next) {
    res.locals.currentUser = req.session.user ?? null;
    res.locals.flash = req.session.flash ?? null;
    res.locals.currentPath = req.originalUrl || "/";
    if (req.session.user) {
        (0, online_user_store_1.touchOnlineSession)(req.sessionID, {
            id: req.session.user.id,
            username: req.session.user.username
        });
        const allowedShopIds = getAllowedShopIds(req.session.user);
        const contextShopOptions = (0, shop_store_1.getAllShopOptions)().filter((shop) => req.session.user.canAccessAllShops ||
            req.session.user.role === "admin" ||
            allowedShopIds.length === 0 ||
            allowedShopIds.includes(shop.id));
        if (!(0, shop_store_1.getShopById)(req.session.user.shopId) && contextShopOptions.length === 1) {
            req.session.user.shopId = contextShopOptions[0].id;
        }
        res.locals.contextShopOptions = contextShopOptions;
        res.locals.activeContextShop =
            contextShopOptions.find((shop) => shop.id === req.session.user.shopId) || null;
    }
    else {
        (0, online_user_store_1.removeOnlineSession)(req.sessionID);
        res.locals.contextShopOptions = [];
        res.locals.activeContextShop = null;
    }
    res.locals.onlineUserCount = (0, online_user_store_1.getOnlineUserCount)();
    delete req.session.flash;
    next();
}
function hasModulePermission(user, permission) {
    if (user.role === "admin") {
        return true;
    }
    return user.modulePermissions.includes(permission);
}
function getAllowedShopIds(user) {
    if (user.canAccessAllShops || user.role === "admin") {
        return [];
    }
    const ids = new Set();
    if (Number.isFinite(user.shopId) && user.shopId > 0) {
        ids.add(user.shopId);
    }
    for (const shopId of user.allowedShopIds || []) {
        if (Number.isFinite(shopId) && shopId > 0) {
            ids.add(shopId);
        }
    }
    return Array.from(ids);
}
function canAccessShop(user, shopId) {
    if (!Number.isFinite(shopId) || shopId <= 0) {
        return false;
    }
    if (user.canAccessAllShops || user.role === "admin") {
        return true;
    }
    return getAllowedShopIds(user).includes(shopId);
}
function requireModulePermission(permission) {
    return (req, res, next) => {
        if (!req.session.user) {
            req.session.flash = {
                type: "warning",
                title: "Chưa đăng nhập",
                text: "Vui lòng đăng nhập để tiếp tục."
            };
            res.redirect("/login");
            return;
        }
        if (!hasModulePermission(req.session.user, permission)) {
            req.session.flash = {
                type: "error",
                title: "Không đủ quyền",
                text: "Tài khoản hiện tại không có quyền truy cập mục này."
            };
            res.redirect("/Installment/Index/");
            return;
        }
        next();
    };
}
function requireAuth(req, res, next) {
    if (!req.session.user) {
        req.session.flash = {
            type: "warning",
            title: "Chưa đăng nhập",
            text: "Vui lòng đăng nhập để tiếp tục."
        };
        res.redirect("/login");
        return;
    }
    next();
}
function requireAdmin(req, res, next) {
    if (!req.session.user) {
        req.session.flash = {
            type: "warning",
            title: "Chưa đăng nhập",
            text: "Vui lòng đăng nhập để tiếp tục."
        };
        res.redirect("/login");
        return;
    }
    if (req.session.user.role !== "admin") {
        req.session.flash = {
            type: "error",
            title: "Không đủ quyền",
            text: "Tài khoản hiện tại không có quyền truy cập mục này."
        };
        res.redirect("/Installment/Index/");
        return;
    }
    next();
}
