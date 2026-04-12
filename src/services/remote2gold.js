"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginTo2Gold = loginTo2Gold;
exports.fetchMoneyData = fetchMoneyData;
exports.fetchRecentActions = fetchRecentActions;
exports.fetchRemotePage = fetchRemotePage;
const cheerio_1 = require("cheerio");
const staff_store_1 = require("./staff-store");
const SITE_ORIGIN = "https://2gold.biz";
const API_ORIGIN = "https://api.2gold.biz";
function toMenuItems(items) {
    return items.map((item) => ({
        id: item.id,
        text: item.text,
        link: item.Link,
        icon: item.Icon ?? null,
        children: (item.children || []).map((child) => ({
            id: child.id,
            text: child.text,
            link: child.Link,
            icon: child.Icon ?? null,
            children: []
        }))
    }));
}
function collectCookies(response) {
    const getSetCookie = response.headers.getSetCookie;
    const setCookies = typeof getSetCookie === "function" ? getSetCookie.call(response.headers) : [];
    return setCookies.map((cookie) => cookie.split(";")[0]).join("; ");
}
async function loginTo2Gold(username, password) {
    const body = new URLSearchParams({
        Username: username,
        Password: password
    });
    const response = await fetch(`${SITE_ORIGIN}/User/ProcessLogin`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        body
    });
    const result = (await response.json());
    if (result.Result !== 1) {
        throw new Error(result.Message || "Đăng nhập thất bại");
    }
    const cookieHeader = collectCookies(response);
    const user = {
        id: result.Data.Id,
        username: result.Data.Username,
        displayName: result.Data.FullName,
        role: result.Data.IsStaff === 1 ? "staff" : "admin",
        shopId: result.Data.ShopID,
        allowedShopIds: result.Data.ShopID > 0 ? [result.Data.ShopID] : [],
        canAccessAllShops: result.Data.IsStaff !== 1,
        modulePermissions: result.Data.IsStaff === 1 ? ["installment", "shop"] : ["installment", "shop", "staff"],
        token: result.Data.Token,
        cookieHeader,
        menus: toMenuItems(result.Data.LstMenu)
    };
    return {
        user: (0, staff_store_1.applyLocalAccessToUser)(user),
        message: result.Message
    };
}
async function remoteFetch(url, user, init) {
    return fetch(url, {
        ...init,
        headers: {
            Cookie: user.cookieHeader,
            ...(init?.headers || {})
        }
    });
}
async function fetchMoneyData(user) {
    const url = new URL(`${API_ORIGIN}/api/CashByDate/GetDataEachDay`);
    url.searchParams.set("UserID", String(user.id));
    url.searchParams.set("ShopID", String(user.shopId));
    url.searchParams.set("Token", user.token);
    const response = await remoteFetch(url.toString(), user);
    const result = (await response.json());
    const moneyData = result.Data || {};
    return {
        MoneyEndDate: Number(moneyData.MoneyEndDate || 0),
        TotalMoneyInvestment: Number(moneyData.TotalMoneyInvestment || 0),
        TotalInterestEarn: Number(moneyData.TotalInterestEarn || 0),
        PawnOpen: Number(moneyData.PawnOpen || 0),
        LoanOpen: Number(moneyData.LoanOpen || 0),
        InstallmentOpen: Number(moneyData.InstallmentOpen || 0),
        TotalContract: Number(moneyData.PawnOpen || 0) +
            Number(moneyData.LoanOpen || 0) +
            Number(moneyData.InstallmentOpen || 0)
    };
}
async function fetchRecentActions(user) {
    const body = new URLSearchParams({
        UserID: String(user.id),
        ShopID: String(user.shopId),
        Token: user.token,
        IsDashboardOwner: "1"
    });
    const response = await remoteFetch(`${API_ORIGIN}/api/Report/ReportRecentActions`, user, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        body
    });
    const result = (await response.json());
    return result.Data || [];
}
async function fetchRemotePage(pathname, user) {
    const response = await remoteFetch(new URL(pathname, SITE_ORIGIN).toString(), user);
    const html = await response.text();
    const $ = (0, cheerio_1.load)(html);
    const title = $(".m-subheader__title").first().text().trim() || $("title").text().trim() || "Beat5";
    const subheaderHtml = $(".m-subheader").first().toString();
    const contentHtml = $(".m-content").first().toString();
    const hiddenInputsHtml = $("body input[type='hidden']")
        .map((_, el) => $.html(el))
        .get()
        .join("");
    const extraStyles = $("head link[rel='stylesheet']")
        .map((_, el) => $(el).attr("href") || "")
        .get()
        .filter((href) => Boolean(href) && href.startsWith("/"))
        .filter((href) => !href.includes("/Template/assets/vendors/base/vendors.bundle.css"))
        .filter((href) => !href.includes("/Template/assets/demo/default/base/style.bundle.css"));
    const extraScripts = $("script[src]")
        .map((_, el) => $(el).attr("src") || "")
        .get()
        .filter((src) => Boolean(src) && src.startsWith("/"))
        .filter((src) => !src.includes("/Template/assets/vendors/base/vendors.bundle.js"))
        .filter((src) => !src.includes("/Template/assets/demo/default/base/scripts.bundle.js"));
    const inlineScripts = $("script:not([src])")
        .map((_, el) => $(el).html() || "")
        .get()
        .filter((script) => script.trim().length > 0);
    return {
        title,
        subheaderHtml,
        contentHtml,
        hiddenInputsHtml,
        extraStyles: [...new Set(extraStyles)],
        extraScripts: [...new Set(extraScripts)],
        inlineScripts
    };
}
