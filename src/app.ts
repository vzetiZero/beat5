import path from "node:path";

import express, { Request, Response } from "express";
import session from "express-session";
import multer from "multer";
import * as XLSX from "xlsx";

import { moduleApiGroups } from "./config/module-api";
import { appNavItems } from "./config/menu";
import { passthroughMvcRoutes, remoteModulePages } from "./config/module-routes";
import {
  attachViewState,
  canAccessShop,
  getAllowedShopIds,
  hasModulePermission,
  requireAdmin,
  requireAuth,
  requireModulePermission
} from "./middleware/auth";
import {
  assignLegacyInstallmentsToShop,
  countInstallmentsByInstallerNames,
  countInstallmentsByShop,
  countLegacyInstallments,
  deleteInstallments,
  deleteInstallment,
  getInstallmentById,
  getInstallmentSnapshotById,
  getInstallmentPageBootstrap,
  importInstallmentsFromExcel,
  listInstallments,
  restoreInstallmentFromSnapshot,
  saveInstallment,
  transferInstallmentsInstallerNames,
  transferInstallmentsToShop,
  previewInstallment,
  updateInstallmentCollectionProgress,
  updateInstallmentNextPaymentDay,
  updateInstallmentStatus
} from "./services/installment-store";
import { listProvinceOptions, listWardOptionsByProvinceCode } from "./services/localities";
import { listAuditLogs, listAuditLogsForExport, writeAuditLog, writeAuditLogFromRequest } from "./services/audit-log-store";
import { removeOnlineSession } from "./services/online-user-store";
import {
  deleteShop,
  deleteShops,
  getAllShopOptions,
  getShopById,
  getShopSnapshotById,
  listShops,
  restoreShopFromSnapshot,
  saveShop,
  updateShopStatus
} from "./services/shop-store";
import {
  fetchMoneyData,
  fetchRecentActions,
  fetchRemotePage,
  loginTo2Gold
} from "./services/remote2gold";
import {
  deleteStaff,
  deleteStaffMany,
  authenticateLocalStaffLogin,
  countStaffByShop,
  findLocalStaffByUsername,
  getAllActiveStaff,
  getStaffById,
  getStaffSnapshotById,
  listStaff,
  reassignStaffToShop,
  restoreStaffFromSnapshot,
  saveStaff,
  updateStaffStatus,
  updateStaffPermissions
} from "./services/staff-store";
import { addTrashItem, getTrashItemById, listTrashItems, markTrashItemRestored } from "./services/trash-store";

const API_ORIGIN = "https://api.2gold.biz";
const FILE_ORIGIN = "https://api.2gold.biz/FileUpload";
const SITE_ORIGIN = "https://2gold.biz";
const INSTALLMENT_VIEW_ONLY_MODE = false;
const upload = multer({ storage: multer.memoryStorage() });
const UTF8_CONTENT_TYPE_PREFIXES = [
  "text/",
  "application/javascript",
  "application/json",
  "application/ld+json",
  "application/manifest+json",
  "application/xml",
  "image/svg+xml"
];

function withUtf8Charset(contentType: string | null) {
  const normalized = String(contentType || "").trim();
  if (!normalized) {
    return normalized;
  }

  const lower = normalized.toLowerCase();
  if (lower.includes("charset=")) {
    return normalized;
  }

  const [mediaType] = lower.split(";", 1);
  if (!UTF8_CONTENT_TYPE_PREFIXES.some((prefix) => mediaType.startsWith(prefix))) {
    return normalized;
  }

  return `${normalized}; charset=utf-8`;
}

function createUtf8StaticMiddleware(staticRoot: string) {
  return express.static(staticRoot, {
    setHeaders(res) {
      const contentTypeHeader = res.getHeader("Content-Type");
      const nextContentType = withUtf8Charset(
        typeof contentTypeHeader === "string" ? contentTypeHeader : null
      );

      if (nextContentType) {
        res.setHeader("Content-Type", nextContentType);
      }
    }
  });
}

function visibleNavItems(user: NonNullable<Request["session"]["user"]>) {
  function canSeePath(href: string) {
    if (href === "/Installment/Create") {
      return hasModulePermission(user, "installment");
    }
    if (href === "/Shop/Create") {
      return user.canAccessAllShops || user.role === "admin";
    }
    if (href === "/Staff/Create") {
      return hasModulePermission(user, "staff");
    }
    return true;
  }

  return appNavItems
    .filter(
      (item) =>
        (!item.roles || item.roles.includes(user.role)) &&
        (!item.permission || hasModulePermission(user, item.permission))
    )
    .map((item) => ({
      ...item,
      children: item.children ? item.children.filter((child) => canSeePath(child.href)) : undefined
    }));
}

function getScopedShopOptions(user: NonNullable<Request["session"]["user"]>) {
  const options = getAllShopOptions();
  const allowedShopIds = getAllowedShopIds(user);

  if (user.canAccessAllShops || user.role === "admin" || allowedShopIds.length === 0) {
    return options;
  }

  return options.filter((shop: { id: number }) => allowedShopIds.includes(shop.id));
}

function getInstallerOptions(
  user: NonNullable<Request["session"]["user"]>,
  selectedInstallerName?: string | null
) {
  const allowedShopIds =
    user.canAccessAllShops || user.role === "admin" ? undefined : getAllowedShopIds(user);
  const optionMap = new Map<string, { value: string; label: string; shopId: number }>();

  for (const staff of getAllActiveStaff(allowedShopIds)) {
    const displayName = String(staff.fullName || staff.username || "").trim();
    if (!displayName) {
      continue;
    }

    optionMap.set(displayName, {
      value: displayName,
      label: displayName,
      shopId: Number(staff.shopId || 0)
    });
  }

  const currentUserName = String(user.displayName || user.username || "").trim();
  if (currentUserName && !optionMap.has(currentUserName)) {
    optionMap.set(currentUserName, {
      value: currentUserName,
      label: currentUserName,
      shopId: Number(user.shopId || 0)
    });
  }

  const selectedName = String(selectedInstallerName || "").trim();
  if (selectedName && !optionMap.has(selectedName)) {
    optionMap.set(selectedName, {
      value: selectedName,
      label: selectedName,
      shopId: 0
    });
  }

  return Array.from(optionMap.values()).sort((left, right) => left.label.localeCompare(right.label, "vi"));
}

function requireShopScope(user: NonNullable<Request["session"]["user"]>, shopId: number) {
  return canAccessShop(user, shopId);
}

function resolveActiveShopForUser(user: NonNullable<Request["session"]["user"]>) {
  const currentShop = getShopById(user.shopId);
  if (currentShop) {
    return currentShop;
  }

  const scopedShops = getScopedShopOptions(user);
  if (scopedShops.length === 1) {
    user.shopId = scopedShops[0].id;
    return scopedShops[0];
  }

  return null;
}

function reconcileLegacyInstallmentsForUser(user: NonNullable<Request["session"]["user"]>) {
  if ((!user.canAccessAllShops && user.role !== "admin") || countLegacyInstallments() === 0) {
    return 0;
  }

  const activeShop = resolveActiveShopForUser(user);
  if (!activeShop) {
    return 0;
  }

  return assignLegacyInstallmentsToShop(activeShop.id, activeShop.name);
}

function safeWriteAuditLog(input: Parameters<typeof writeAuditLog>[0]) {
  try {
    writeAuditLog(input);
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

function safeWriteAuditLogFromRequest(
  user: Request["session"]["user"],
  req: Pick<Request, "method" | "originalUrl" | "ip">,
  input: Parameters<typeof writeAuditLogFromRequest>[2]
) {
  try {
    writeAuditLogFromRequest(user, req, input);
  } catch (error) {
    console.error("Failed to write audit log from request", error);
  }
}

function logPageAccess(req: Request, moduleName: string, description: string, extra?: { shopId?: number | null; shopName?: string }) {
  safeWriteAuditLogFromRequest(req.session.user, req, {
    moduleName,
    actionType: "access",
    entityType: "page",
    entityId: req.path,
    description,
    shopId: extra?.shopId,
    shopName: extra?.shopName
  });
}

function parseOptionalNumber(value: unknown): number | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIdList(value: unknown): number[] {
  const rawValues = Array.isArray(value) ? value : String(value ?? "").split(",");
  return Array.from(
    new Set(
      rawValues
        .map((item) => Number(String(item ?? "").trim()))
        .filter((item) => Number.isFinite(item) && item > 0)
        .map((item) => Math.trunc(item))
    )
  );
}

function parseBooleanFlag(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function buildInstallmentPopupPayload(
  source: Record<string, unknown>,
  shopId: number,
  fallback?: Record<string, unknown>
) {
  const fallbackSource = fallback || {};
  const loanPackage = parseOptionalNumber(source.loanPackage) ?? parseOptionalNumber(fallbackSource.loanPackage) ?? 0;
  const revenue = parseOptionalNumber(source.revenue) ?? parseOptionalNumber(fallbackSource.revenue) ?? 0;

  return {
    stt:
      parseOptionalNumber(source.stt) ??
      parseOptionalNumber(source.codeId) ??
      parseOptionalNumber(fallbackSource.stt) ??
      null,
    shopId,
    customerRef: normalizeLooseText(source.customerRef ?? source.customerName ?? fallbackSource.customerRef ?? ""),
    imei: normalizeLooseText(source.imei ?? fallbackSource.imei ?? ""),
    loanDate: normalizeLooseText(source.loanDate ?? fallbackSource.loanDate ?? ""),
    loanPackage,
    revenue,
    setupFee: parseOptionalNumber(source.setupFee) ?? parseOptionalNumber(fallbackSource.setupFee) ?? 0,
    netDisbursement:
      parseOptionalNumber(source.netDisbursement) ??
      parseOptionalNumber(fallbackSource.netDisbursement) ??
      loanPackage,
    paidBefore: parseOptionalNumber(source.paidBefore) ?? parseOptionalNumber(fallbackSource.paidBefore) ?? 0,
    paymentDay: normalizeLooseText(source.paymentDay ?? fallbackSource.paymentDay ?? ""),
    loanDays: parseOptionalNumber(source.loanDays) ?? parseOptionalNumber(fallbackSource.loanDays) ?? null,
    collectionIntervalDays:
      parseOptionalNumber(source.collectionIntervalDays) ??
      parseOptionalNumber(fallbackSource.collectionIntervalDays) ??
      1,
    installmentAmount:
      parseOptionalNumber(source.installmentAmount) ??
      parseOptionalNumber(fallbackSource.installmentAmount) ??
      0,
    note: normalizeLooseText(source.note ?? fallbackSource.note ?? ""),
    installerName: normalizeLooseText(source.installerName ?? fallbackSource.installerName ?? ""),
    referralFee: parseOptionalNumber(source.referralFee) ?? parseOptionalNumber(fallbackSource.referralFee) ?? 0,
    mc: normalizeLooseText(source.mc ?? fallbackSource.mc ?? ""),
    statusCode:
      parseOptionalNumber(source.statusCode) ??
      parseOptionalNumber(fallbackSource.statusCode) ??
      0,
    statusText: normalizeLooseText(source.statusText ?? fallbackSource.statusText ?? "Mới tạo"),
    paymentMethod: normalizeLooseText(source.paymentMethod ?? fallbackSource.paymentMethod ?? "periodic") || "periodic",
    collectInAdvance: parseBooleanFlag(source.collectInAdvance ?? fallbackSource.collectInAdvance),
    prepaidPeriodCount:
      parseOptionalNumber(source.prepaidPeriodCount) ??
      parseOptionalNumber(fallbackSource.prepaidPeriodCount) ??
      0
  };
}

function normalizeLooseText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function buildStaffInstallerNameCandidates(staff: { username?: string; fullName?: string }) {
  const candidates = [normalizeLooseText(staff.fullName), normalizeLooseText(staff.username)];
  return Array.from(new Set(candidates.filter(Boolean)));
}

function resolveStaffDisplayName(staff: { username?: string; fullName?: string }) {
  return normalizeLooseText(staff.fullName) || normalizeLooseText(staff.username);
}

function getAuditScope(user: NonNullable<Request["session"]["user"]>) {
  if (user.canAccessAllShops || user.role === "admin") {
    return {
      allowedShopIds: [] as number[],
      viewerUserId: null as number | null
    };
  }

  return {
    allowedShopIds: getAllowedShopIds(user),
    viewerUserId: user.id
  };
}

function resolveScopedHistoryShopId(user: NonNullable<Request["session"]["user"]>, requestedShopId: number | null) {
  if (requestedShopId && canAccessShop(user, requestedShopId)) {
    return requestedShopId;
  }

  if (user.canAccessAllShops || user.role === "admin") {
    return requestedShopId;
  }

  return null;
}

function buildHistoryFilters(user: NonNullable<Request["session"]["user"]>, source: Request["query"]) {
  const requestedShopId = parseOptionalNumber(source.shopId);
  const scopedShopId = resolveScopedHistoryShopId(user, requestedShopId);

  return {
    generalSearch: String(source.generalSearch || ""),
    moduleName: String(source.moduleName || ""),
    actionType: String(source.actionType || ""),
    actorUsername: String(source.actorUsername || ""),
    shopId: scopedShopId,
    fromDate: String(source.fromDate || ""),
    toDate: String(source.toDate || ""),
    page: Number(source.page || 1),
    perPage: Number(source.perPage || 50),
    ...getAuditScope(user)
  };
}

function buildHistoryQueryString(filters: {
  generalSearch?: string;
  moduleName?: string;
  actionType?: string;
  actorUsername?: string;
  shopId?: number | null;
  fromDate?: string;
  toDate?: string;
  perPage?: number;
  page?: number;
}) {
  const params = new URLSearchParams();
  const setParam = (key: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined) {
      return;
    }

    const normalized = String(value).trim();
    if (!normalized || normalized === "0") {
      return;
    }

    params.set(key, normalized);
  };

  setParam("generalSearch", filters.generalSearch);
  setParam("moduleName", filters.moduleName);
  setParam("actionType", filters.actionType);
  setParam("actorUsername", filters.actorUsername);
  setParam("shopId", filters.shopId);
  setParam("fromDate", filters.fromDate);
  setParam("toDate", filters.toDate);
  setParam("perPage", filters.perPage);
  setParam("page", filters.page);
  return params.toString();
}

type ModulePermission = "installment" | "shop" | "staff";

function toModulePermission(value: unknown): ModulePermission | null {
  if (value === "installment" || value === "shop" || value === "staff") {
    return value;
  }
  return null;
}

function normalizeRoutePath(pathValue: string) {
  const normalized = String(pathValue || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function resolveModulePermissionFromPagePath(pathname: string): ModulePermission | null {
  const normalized = normalizeRoutePath(pathname).toLowerCase();
  if (normalized.startsWith("/installment/")) {
    return "installment";
  }
  if (normalized.startsWith("/shop/")) {
    return "shop";
  }
  if (normalized.startsWith("/staff/")) {
    return "staff";
  }
  return null;
}

function resolveModulePermissionFromApiPath(apiPath: string): ModulePermission | null {
  const normalized = normalizeRoutePath(apiPath).toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const group of moduleApiGroups as any[]) {
    const modulePermission = toModulePermission(group?.module);
    if (!modulePermission || !Array.isArray(group?.apiEndpoints)) {
      continue;
    }

    const matched = group.apiEndpoints.some((endpoint: unknown) => {
      const endpointPath = normalizeRoutePath(String(endpoint || "")).toLowerCase();
      return endpointPath ? normalized.startsWith(endpointPath) : false;
    });

    if (matched) {
      return modulePermission;
    }
  }

  return null;
}

function resolveModulePermissionFromMvcPath(mvcPath: string): ModulePermission | null {
  const normalized = normalizeRoutePath(mvcPath).toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const group of moduleApiGroups as any[]) {
    const modulePermission = toModulePermission(group?.module);
    if (!modulePermission || !Array.isArray(group?.mvcEndpoints)) {
      continue;
    }

    const matched = group.mvcEndpoints.some((endpoint: unknown) => {
      const endpointPath = normalizeRoutePath(String(endpoint || "")).toLowerCase();
      return endpointPath === normalized;
    });

    if (matched) {
      return modulePermission;
    }
  }

  return null;
}

async function renderRemotePage(req: Request, res: Response, pathname: string, pageTitleFallback: string) {
  if (!req.session.user) {
    res.redirect("/login");
    return;
  }

  const pageData = await fetchRemotePage(pathname, req.session.user);
  res.render("remote-page", {
    pageTitle: pageData.title || pageTitleFallback,
    activePath: pathname,
    navItems: visibleNavItems(req.session.user),
    subheaderHtml: pageData.subheaderHtml,
    contentHtml: pageData.contentHtml,
    hiddenInputsHtml: pageData.hiddenInputsHtml,
    extraStyles: pageData.extraStyles,
    extraScripts: pageData.extraScripts,
    inlineScripts: pageData.inlineScripts
  });
}

function buildForwardBody(req: Request): BodyInit | undefined {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  if (req.is("application/json")) {
    return JSON.stringify(req.body ?? {});
  }

  if (req.is("application/x-www-form-urlencoded")) {
    return new URLSearchParams(
      Object.entries(req.body ?? {}).map(([key, value]) => [key, String(value)])
    ).toString();
  }

  return undefined;
}

function getOriginalQuery(req: Request): string {
  const queryIndex = req.originalUrl.indexOf("?");
  return queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : "";
}

async function forwardProxyRequest(
  req: Request,
  res: Response,
  upstreamBase: string,
  relativePath: string
) {
  if (!req.session.user) {
    res.status(401).json({ Result: -1, Message: "Unauthorized" });
    return;
  }

  const targetUrl = new URL(relativePath, upstreamBase);
  if (!targetUrl.search) {
    targetUrl.search = getOriginalQuery(req);
  }

  const contentType = req.headers["content-type"];
  const response = await fetch(targetUrl.toString(), {
    method: req.method,
    headers: {
      Cookie: req.session.user.cookieHeader,
      ...(contentType ? { "Content-Type": contentType } : {})
    },
    body: buildForwardBody(req)
  });

  res.status(response.status);
  const responseType = response.headers.get("content-type");
  if (responseType) {
    res.setHeader("Content-Type", withUtf8Charset(responseType));
  }

  const locationHeader = response.headers.get("location");
  if (locationHeader) {
    res.setHeader("Location", locationHeader.replace(SITE_ORIGIN, ""));
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  res.send(buffer);
}

async function forwardSiteRequest(req: Request, res: Response, relativePath: string) {
  await forwardProxyRequest(req, res, SITE_ORIGIN, `${relativePath}${getOriginalQuery(req)}`);
}

export function createApp() {
  const app = express();
  const rootDir = path.resolve(__dirname, "..");
  const legacyAssetsRoot = path.join(rootDir, "public", "legacy");

  app.set("views", path.join(rootDir, "views"));
  app.set("view engine", "ejs");

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "2gold-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 8
      }
    })
  );
  app.use(attachViewState);

  app.use("/Template", createUtf8StaticMiddleware(path.join(legacyAssetsRoot, "Template")));
  app.use("/Content", createUtf8StaticMiddleware(path.join(legacyAssetsRoot, "Content")));
  app.use("/Images", createUtf8StaticMiddleware(path.join(legacyAssetsRoot, "Images")));
  app.use("/fonts", createUtf8StaticMiddleware(path.join(legacyAssetsRoot, "fonts")));
  app.use("/Script", createUtf8StaticMiddleware(path.join(legacyAssetsRoot, "Script")));
  app.use("/public", createUtf8StaticMiddleware(path.join(rootDir, "public")));

  app.all("/proxy/api/*", requireAuth, async (req: Request, res: Response) => {
    const user = req.session.user!;
    const apiPath = `/${String(req.params[0] || "")}`;
    const modulePermission = resolveModulePermissionFromApiPath(apiPath);
    if (!modulePermission && user.role !== "admin") {
      res.status(403).json({
        Result: -1,
        Message: "Endpoint API nay khong nam trong module duoc cap quyen."
      });
      return;
    }
    if (modulePermission && !hasModulePermission(user, modulePermission)) {
      res.status(403).json({
        Result: -1,
        Message: "Tai khoan hien tai khong duoc phep goi API cua module nay."
      });
      return;
    }

    await forwardProxyRequest(req, res, API_ORIGIN, `/api/${req.params[0]}`);
  });

  app.all("/proxy/file/*", requireAuth, async (req: Request, res: Response) => {
    const user = req.session.user!;
    const filePath = `/${String(req.params[0] || "")}`;
    const modulePermission = resolveModulePermissionFromApiPath(filePath);
    if (!modulePermission && user.role !== "admin") {
      res.status(403).json({
        Result: -1,
        Message: "Duong dan tep nay khong nam trong module duoc cap quyen."
      });
      return;
    }
    if (modulePermission && !hasModulePermission(user, modulePermission)) {
      res.status(403).json({
        Result: -1,
        Message: "Tai khoan hien tai khong duoc phep tai tep cho module nay."
      });
      return;
    }
    await forwardProxyRequest(req, res, FILE_ORIGIN, `/${req.params[0]}`);
  });

  for (const route of passthroughMvcRoutes) {
    const routePermission = resolveModulePermissionFromMvcPath(route);
    const guard = routePermission ? requireModulePermission(routePermission) : requireAdmin;
    app.all(route, guard, async (req: Request, res: Response) => {
      await forwardSiteRequest(req, res, route);
    });
  }

    app.get("/", (req: Request, res: Response) => {
    res.redirect(req.session.user ? "/Installment/Index/" : "/login");
    });

    app.get("/login", (req: Request, res: Response) => {
      if (req.session.user) {
      res.redirect("/Installment/Index/");
        return;
      }

    res.render("login", {
      pageTitle: "??ng nh?p v?o h? th?ng"
    });
  });

  app.post("/login", async (req: Request, res: Response) => {
    try {
      const username = String(req.body.Username || "").trim();
      const password = String(req.body.Password || "");

      const localStaff = findLocalStaffByUsername(username);
      if (localStaff) {
        if (localStaff.status !== 1) {
          throw new Error("T?i kho?n nh?n vi?n ?? b? kh?a.");
        }

        const localAuth = authenticateLocalStaffLogin(username, password);
        if (!localAuth) {
          throw new Error("Sai t?i kho?n ho?c m?t kh?u nh?n vi?n.");
        }

        const { user } = localAuth;
        req.session.user = user;
        safeWriteAuditLog({
          actorUserId: user.id,
          actorUsername: user.username,
          actorDisplayName: user.displayName,
          actorRole: user.role,
          shopId: user.shopId,
          moduleName: "auth",
          actionType: "login",
          method: req.method,
          path: req.originalUrl,
          entityType: "session",
          entityId: user.id,
          description: `Dang nhap local thanh cong: ${user.username}`,
          metadata: {
            shopId: user.shopId,
            canAccessAllShops: user.canAccessAllShops,
            authSource: "local"
          },
          ipAddress: req.ip
        });
        req.session.flash = {
          type: "success",
          title: "??ng nh?p th?nh c?ng",
          text: "Nh?n vi?n ?? ???c x?c th?c n?i b?.",
          mode: "login-success",
          confirmButtonText: "Tiếp tục",
          timer: 2500
        };
        res.redirect("/Installment/Index/");
        return;
      }

      const { user, message } = await loginTo2Gold(username, password);
      req.session.user = user;
      safeWriteAuditLog({
        actorUserId: user.id,
        actorUsername: user.username,
        actorDisplayName: user.displayName,
        actorRole: user.role,
        shopId: user.shopId,
        moduleName: "auth",
        actionType: "login",
        method: req.method,
        path: req.originalUrl,
        entityType: "session",
        entityId: user.id,
        description: `Dang nhap thanh cong: ${user.username}`,
        metadata: {
          shopId: user.shopId,
          canAccessAllShops: user.canAccessAllShops
        },
        ipAddress: req.ip
      });
      req.session.flash = {
        type: "success",
        title: "??ng nh?p th?nh c?ng",
        text: message,
        mode: "login-success",
        confirmButtonText: "Tiếp tục",
        timer: 2500
      };
      res.redirect("/Installment/Index/");
    } catch (error) {
      const username = String(req.body.Username || "").trim();
      safeWriteAuditLog({
        actorUsername: username,
        moduleName: "auth",
        actionType: "login_failed",
        method: req.method,
        path: req.originalUrl,
        entityType: "session",
        entityId: username || "anonymous",
        description: `Dang nhap that bai: ${username || "unknown"}`,
        metadata: {
          reason: error instanceof Error ? error.message : "Login failed"
        },
        ipAddress: req.ip
      });
      req.session.flash = {
        type: "error",
        title: "??ng nh?p th?t b?i",
        text: error instanceof Error ? error.message : "Kh?ng th? ??ng nh?p v?o 2gold.biz",
        mode: "modal",
        username
      };
      res.redirect("/login");
    }
  });

  app.post("/logout", requireAuth, (req: Request, res: Response) => {
    const user = req.session.user!;
    safeWriteAuditLogFromRequest(user, req, {
      moduleName: "auth",
      actionType: "logout",
      entityType: "session",
      entityId: user.id,
      description: `Dang xuat tai khoan ${user.username}`,
      shopId: user.shopId
    });
    req.session.user = undefined;
    removeOnlineSession(req.sessionID);
    req.session.flash = {
      type: "success",
      title: "??ng xu?t th?nh c?ng",
      text: "B?n ?? ??ng xu?t kh?i h? th?ng.",
      mode: "toast"
    };
    req.session.save(() => {
      res.redirect("/login");
    });
  });

  app.post("/context/shop", requireAuth, (req: Request, res: Response) => {
    const user = req.session.user!;
    const nextShopId = parseOptionalNumber(req.body.shopId);
    const returnTo =
      typeof req.body.returnTo === "string" && req.body.returnTo.startsWith("/") ? req.body.returnTo : "/Installment/Index/";

    if (!nextShopId || !canAccessShop(user, nextShopId)) {
      req.session.flash = {
        type: "error",
        title: "Kh?ng th? chuy?n c?a h?ng",
        text: "C?a h?ng ???c ch?n kh?ng thu?c ph?m vi truy c?p c?a t?i kho?n.",
        mode: "modal"
      };
      res.redirect(returnTo);
      return;
    }

    const nextShop = getShopById(nextShopId);
    req.session.user = {
      ...user,
      shopId: nextShopId
    };
    safeWriteAuditLogFromRequest(req.session.user, req, {
      moduleName: "auth",
      actionType: "context_switch",
      entityType: "shop",
      entityId: nextShopId,
      description: `Chuyen context cua hang sang ${nextShop?.name || nextShopId}`,
      shopId: nextShopId,
      shopName: nextShop?.name || ""
    });
    req.session.flash = {
      type: "success",
      title: "Da chuyen cua hang",
      text: "Context lam viec da duoc cap nhat.",
      mode: "toast"
    };
    res.redirect(returnTo);
  });

  function renderInstallmentPage(
    req: Request,
    res: Response,
    options: {
      activePath: "/Installment/Index/" | "/Calendar/Installment";
      pageMode: "list" | "calendar";
      defaultDueStatus?: string;
      defaultSortColumn?: string;
      defaultSortDirection?: "asc" | "desc";
    }
  ) {
    const user = req.session.user!;
    const canManageAllShops = user.canAccessAllShops || user.role === "admin";
    const repairedLegacyRows = reconcileLegacyInstallmentsForUser(user);
    if (repairedLegacyRows > 0) {
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "installment",
        actionType: "repair",
        entityType: "installment",
        entityId: "legacy-shop-scope",
        description: `Gan ${repairedLegacyRows} hop dong tra gop cu vao cua hang hien hanh`,
        shopId: user.shopId
      });
      req.session.flash = {
        type: "info",
        title: "Da dong bo du lieu cu",
        text: `Da gan ${repairedLegacyRows} hop dong tra gop cu vao cua hang hien hanh de tiep tuc chinh sua.`,
        mode: "toast"
      };
    }
    logPageAccess(
      req,
      "installment",
      options.pageMode === "calendar" ? "Truy cap lich thanh toan tra gop" : "Truy cap danh sach tra gop",
      {
      shopId: user.shopId
      }
    );
    const bootstrapSource = listInstallments({
      dueStatus: options.defaultDueStatus || "",
      allowedShopIds: canManageAllShops ? undefined : getAllowedShopIds(user)
    });
    const bootstrap = {
      availableLoanDays: bootstrapSource.availableLoanDays,
      availableStatuses: bootstrapSource.availableStatuses,
      statusSummary: bootstrapSource.statusSummary,
      dashboard: bootstrapSource.dashboard,
      lastImport: bootstrapSource.lastImport
    };
    const shopOptions = getScopedShopOptions(user);
    const installerOptions = getInstallerOptions(user);

    res.render("installment-index", {
      pageTitle: options.pageMode === "calendar" ? "Lich thanh toan tra gop" : "Tra gop",
      activePath: options.activePath,
      navItems: visibleNavItems(user),
      bootstrap,
      shopOptions,
      installerOptions,
      defaultShopId: canManageAllShops ? 0 : user.shopId,
      canSelectShop: canManageAllShops,
      canCreateInstallment: hasModulePermission(user, "installment"),
      canDeleteInstallment: hasModulePermission(user, "installment"),
      canImportInstallment: hasModulePermission(user, "installment"),
      installmentPageMode: options.pageMode,
      defaultDueStatus: options.defaultDueStatus || "",
      defaultSortColumn: options.defaultSortColumn || "loanDate",
      defaultSortDirection: options.defaultSortDirection || "desc",
      installmentViewOnlyMode: INSTALLMENT_VIEW_ONLY_MODE,
      mockInstallments: [],
      extraStyles: ["/public/installment.css"],
      extraScripts: ["/public/installment.js"],
      inlineScripts: []
    });
  }

  app.get("/Installment/Index/", requireModulePermission("installment"), (req: Request, res: Response) => {
    renderInstallmentPage(req, res, {
      activePath: "/Installment/Index/",
      pageMode: "list"
    });
  });

  app.get("/Calendar/Installment", requireModulePermission("installment"), (req: Request, res: Response) => {
    renderInstallmentPage(req, res, {
      activePath: "/Calendar/Installment",
      pageMode: "calendar",
      defaultDueStatus: "calendar_due",
      defaultSortColumn: "paymentDay",
      defaultSortDirection: "asc"
    });
  });

  app.get("/Installment/Create", requireModulePermission("installment"), (req: Request, res: Response) => {
    res.redirect("/Installment/Index/");
  });

  app.get("/Installment/Edit/:id", requireModulePermission("installment"), (req: Request, res: Response) => {
    res.redirect("/Installment/Index/");
  });

  app.post("/Installment/Create", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const canManageAllShops = user.canAccessAllShops || user.role === "admin";
      const shopId = canManageAllShops ? parseOptionalNumber(req.body.shopId) : user.shopId;
      if (!shopId || !requireShopScope(user, shopId)) {
        throw new Error("Ban khong duoc tao hop dong cho cua hang nay.");
      }

      const created = saveInstallment({
        ...req.body,
        shopId
      });
      if (!created) {
        throw new Error("Khong the tao moi hop dong tra gop.");
      }
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "installment",
        actionType: "create",
        entityType: "installment",
        entityId: created.id,
        description: `Tao hop dong tra gop ${created.customerRef || created.imei || created.id}`,
        shopId: created.shopId,
        shopName: created.shopName,
        metadata: {
          customerRef: created.customerRef,
          imei: created.imei,
          revenue: created.revenue
        }
      });
      req.session.flash = {
        type: "success",
        title: "Luu thanh cong",
        text: "Da tao moi hop dong tra gop.",
        mode: "toast"
      };
      res.redirect("/Installment/Index/");
    } catch (error) {
      req.session.flash = {
        type: "error",
        title: "Khong the luu",
        text: error instanceof Error ? error.message : "Khong the tao moi hop dong tra gop.",
        mode: "modal"
      };
      res.redirect("/Installment/Index/");
    }
  });

  app.post("/Installment/Edit/:id", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const canManageAllShops = user.canAccessAllShops || user.role === "admin";
      reconcileLegacyInstallmentsForUser(user);
      const existing = getInstallmentById(Number(req.params.id));
      if (!existing || !requireShopScope(user, existing.shopId)) {
        throw new Error("Ban khong duoc cap nhat hop dong cua cua hang nay.");
      }

      const shopId = canManageAllShops ? parseOptionalNumber(req.body.shopId) : existing.shopId;
      if (!shopId || !requireShopScope(user, shopId)) {
        throw new Error("Ban khong duoc chuyen hop dong sang cua hang nay.");
      }

      const updated = saveInstallment(
        {
          ...req.body,
          shopId
        },
        Number(req.params.id)
      );
      if (!updated) {
        throw new Error("Khong the cap nhat hop dong tra gop.");
      }
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "installment",
        actionType: "update",
        entityType: "installment",
        entityId: updated.id,
        description: `Cap nhat hop dong tra gop ${updated.customerRef || updated.imei || updated.id}`,
        shopId: updated.shopId,
        shopName: updated.shopName,
        metadata: {
          customerRef: updated.customerRef,
          imei: updated.imei,
          revenue: updated.revenue
        }
      });
      req.session.flash = {
        type: "success",
        title: "Cap nhat thanh cong",
        text: "Da cap nhat hop dong tra gop.",
        mode: "toast"
      };
      res.redirect("/Installment/Index/");
    } catch (error) {
      req.session.flash = {
        type: "error",
        title: "Khong the cap nhat",
        text: error instanceof Error ? error.message : "Khong the cap nhat hop dong tra gop.",
        mode: "modal"
      };
      res.redirect("/Installment/Index/");
    }
  });

  app.get("/installment/api/:id(\\d+)", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      reconcileLegacyInstallmentsForUser(user);
      const installment = getInstallmentById(Number(req.params.id));
      if (!installment || !requireShopScope(user, installment.shopId)) {
        res.status(404).json({
          Result: -1,
          Message: "Khong tim thay hop dong tra gop."
        });
        return;
      }

      res.json({
        Result: 1,
        item: installment
      });
    } catch (error) {
      res.status(400).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Khong the tai hop dong tra gop."
      });
    }
  });

  app.post("/installment/api/preview", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const canManageAllShops = user.canAccessAllShops || user.role === "admin";
      const requestedShopId = canManageAllShops ? parseOptionalNumber(req.body.shopId) : user.shopId;
      if (!requestedShopId || !requireShopScope(user, requestedShopId)) {
        throw new Error("Ban khong duoc xem du lieu cua cua hang nay.");
      }

      const payload = buildInstallmentPopupPayload(req.body, requestedShopId);
      const preview = previewInstallment(payload);
      res.json({
        Result: 1,
        item: preview.normalized,
        summary: preview.summary,
        schedule: preview.schedule
      });
    } catch (error) {
      res.status(400).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Khong the tinh toan hop dong tra gop."
      });
    }
  });

  app.post("/installment/api", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const canManageAllShops = user.canAccessAllShops || user.role === "admin";
      const requestedShopId = canManageAllShops ? parseOptionalNumber(req.body.shopId) : user.shopId;
      if (!requestedShopId || !requireShopScope(user, requestedShopId)) {
        throw new Error("Ban khong duoc tao hop dong cho cua hang nay.");
      }

      const payload = buildInstallmentPopupPayload(req.body, requestedShopId, {
        paymentMethod: "periodic",
        statusCode: 0,
        statusText: "Mới tạo",
        installerName: user.displayName || user.username || ""
      });
      const created = saveInstallment(payload);
      if (!created) {
        throw new Error("Khong the tao hop dong tra gop.");
      }

      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "installment",
        actionType: "create",
        entityType: "installment",
        entityId: created.id,
        description: `Tao hop dong tra gop ${created.customerRef || created.imei || created.id}`,
        shopId: created.shopId,
        shopName: created.shopName,
        metadata: {
          customerRef: created.customerRef,
          imei: created.imei,
          revenue: created.revenue
        }
      });

      res.json({
        Result: 1,
        Message: "Da tao moi hop dong tra gop.",
        item: created
      });
    } catch (error) {
      res.status(400).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Khong the tao hop dong tra gop."
      });
    }
  });

  app.put("/installment/api/:id(\\d+)", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const canManageAllShops = user.canAccessAllShops || user.role === "admin";
      reconcileLegacyInstallmentsForUser(user);
      const existing = getInstallmentById(Number(req.params.id));
      if (!existing || !requireShopScope(user, existing.shopId)) {
        throw new Error("Ban khong duoc cap nhat hop dong nay.");
      }

      const requestedShopId = canManageAllShops ? parseOptionalNumber(req.body.shopId) : existing.shopId;
      if (!requestedShopId || !requireShopScope(user, requestedShopId)) {
        throw new Error("Ban khong duoc chuyen hop dong sang cua hang nay.");
      }

      const payload = buildInstallmentPopupPayload(req.body, requestedShopId, existing as unknown as Record<string, unknown>);
      const updated = saveInstallment(payload, Number(req.params.id));
      if (!updated) {
        throw new Error("Khong the cap nhat hop dong tra gop.");
      }

      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "installment",
        actionType: "update",
        entityType: "installment",
        entityId: updated.id,
        description: `Cap nhat hop dong tra gop ${updated.customerRef || updated.imei || updated.id}`,
        shopId: updated.shopId,
        shopName: updated.shopName,
        metadata: {
          customerRef: updated.customerRef,
          imei: updated.imei,
          revenue: updated.revenue
        }
      });

      res.json({
        Result: 1,
        Message: "Da cap nhat hop dong tra gop.",
        item: updated
      });
    } catch (error) {
      res.status(400).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Khong the cap nhat hop dong tra gop."
      });
    }
  });

  app.post("/installment/api/:id(\\d+)/next-date", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      reconcileLegacyInstallmentsForUser(user);
      const installment = getInstallmentById(Number(req.params.id));
      if (!installment || !requireShopScope(user, installment.shopId)) {
        throw new Error("Ban khong duoc cap nhat hop dong nay.");
      }

      const updated = updateInstallmentNextPaymentDay(Number(req.params.id), req.body.paymentDay ?? req.body.nextPaymentDay);
      if (!updated) {
        throw new Error("Khong the cap nhat ngay dong tiep theo.");
      }
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "installment",
        actionType: "update_next_date",
        entityType: "installment",
        entityId: updated.id,
        description: `Cap nhat ngay dong tiep theo cho hop dong ${updated.customerRef || updated.imei || updated.id}`,
        shopId: updated.shopId,
        shopName: updated.shopName,
        metadata: {
          paymentDay: updated.paymentDay
        }
      });

      res.json({
        Result: 1,
        Message: "Da cap nhat ngay dong tiep theo.",
        item: updated
      });
    } catch (error) {
      res.status(400).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Khong the cap nhat ngay dong tiep theo."
      });
    }
  });

  app.get("/installment/api/list", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const canManageAllShops = user.canAccessAllShops || user.role === "admin";
      reconcileLegacyInstallmentsForUser(user);
      const searchShopId = parseOptionalNumber(req.query.SearchShopId);
      if (searchShopId && !requireShopScope(user, searchShopId)) {
        res.status(403).json({
          Result: -1,
          Message: "Ban khong duoc xem du lieu cua cua hang nay."
        });
        return;
      }

        const result = listInstallments({
          generalSearch: String(req.query.generalSearch || ""),
          status: parseOptionalNumber(req.query.Status),
          fromDate: String(req.query.FromDate || ""),
          toDate: String(req.query.ToDate || ""),
          loanTime: parseOptionalNumber(req.query.LoanTime),
          dueStatus: String(req.query.DueStatus || ""),
          searchShopId,
          allowedShopIds: canManageAllShops ? undefined : getAllowedShopIds(user),
          page: Number(req.query.PageCurrent || 1),
        perPage: Number(req.query.PerPageCurrent || 50),
        sortColumn: String(req.query.columnCurrent || "loanDate"),
        sortDirection: String(req.query.sortCurrent || "desc") === "asc" ? "asc" : "desc"
      });

      res.json({
        Result: 1,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Khong the tai danh sach tra gop."
      });
    }
  });

  app.post(
    "/installment/api/import",
    requireModulePermission("installment"),
    upload.single("file"),
    (req: Request, res: Response) => {
      try {
        const user = req.session.user!;
        const canManageAllShops = user.canAccessAllShops || user.role === "admin";
        if (!req.file || !req.file.buffer) {
          res.status(400).json({
            Result: -1,
            Message: "Vui long chon file Excel de nhap du lieu."
          });
          return;
        }

        const requestedShopId = parseOptionalNumber(req.body.shopId);
        const shopId = canManageAllShops ? requestedShopId || user.shopId : user.shopId;
        if (!shopId || !requireShopScope(user, shopId)) {
          res.status(403).json({
            Result: -1,
            Message: "Ban khong duoc nhap du lieu cho cua hang nay."
          });
          return;
        }

        const shop = getShopById(shopId);
        if (!shop) {
          res.status(400).json({
            Result: -1,
            Message: "Cua hang duoc chon khong hop le."
          });
          return;
        }

        const result = importInstallmentsFromExcel(req.file.buffer, req.file.originalname, shop.id, shop.name);
        safeWriteAuditLogFromRequest(user, req, {
          moduleName: "installment",
          actionType: "import",
          entityType: "installment_import",
          entityId: result.fileName,
          description: `Nhap Excel tra gop cho ${shop.name}`,
          shopId: shop.id,
          shopName: shop.name,
          metadata: {
            fileName: result.fileName,
            importedRows: result.importedRows,
            skippedRows: result.skippedRows,
            normalizationLogCount: Array.isArray((result as { normalizationLogs?: unknown[] }).normalizationLogs)
              ? (result as { normalizationLogs?: unknown[] }).normalizationLogs!.length
              : 0
          }
        });
        res.json({
          Result: 1,
          Message: `Da nhap ${result.importedRows} dong tu file ${result.fileName}.`,
          Data: result
        });
      } catch (error) {
        res.status(400).json({
          Result: -1,
          Message: error instanceof Error ? error.message : "Khong the nhap du lieu Excel."
        });
      }
    }
  );

  app.delete("/installment/api/:id(\\d+)", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      reconcileLegacyInstallmentsForUser(user);
      const installmentId = Number(req.params.id);
      const installment = getInstallmentById(installmentId);
      if (!installment || !requireShopScope(user, installment.shopId)) {
        res.status(404).json({
          Result: -1,
          Message: "Khong tim thay ban ghi de xoa."
        });
        return;
      }

      const installmentSnapshot = getInstallmentSnapshotById(installmentId);
      if (!installmentSnapshot) {
        res.status(404).json({
          Result: -1,
          Message: "Khong tim thay du lieu ban ghi de luu vao thung rac."
        });
        return;
      }

      const deleted = deleteInstallment(installmentId);
      if (!deleted) {
        res.status(404).json({
          Result: -1,
          Message: "Khong tim thay ban ghi de xoa."
        });
        return;
      }

      addTrashItem({
        entityType: "installment",
        entityId: installment.id,
        label: installment.customerRef || installment.customerName || installment.imei || `Installment #${installment.id}`,
        payload: installmentSnapshot,
        metadata: {
          customerRef: installment.customerRef,
          imei: installment.imei,
          shopId: installment.shopId,
          shopName: installment.shopName
        },
        deletedBy: user.username
      });

      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "installment",
        actionType: "delete",
        entityType: "installment",
        entityId: installment.id,
        description: `Xoa hop dong tra gop ${installment.customerRef || installment.imei || installment.id}`,
        shopId: installment.shopId,
        shopName: installment.shopName,
        metadata: {
          customerRef: installment.customerRef,
          imei: installment.imei
        }
      });
      res.json({
        Result: 1,
        Message: "Da xoa ban ghi tra gop."
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Khong the xoa ban ghi tra gop."
      });
    }
  });

  app.post("/installment/api/bulk-delete", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      reconcileLegacyInstallmentsForUser(user);
      const ids = parseIdList(req.body.ids);
      if (ids.length === 0) {
        res.status(400).json({
          Result: -1,
          Message: "Vui long chon it nhat mot hop dong tra gop."
        });
        return;
      }

      const installments = ids.map((id) => getInstallmentById(id)).filter(Boolean);
      if (installments.length !== ids.length || installments.some((item) => !requireShopScope(user, item!.shopId))) {
        res.status(403).json({
          Result: -1,
          Message: "Co hop dong khong ton tai hoac nam ngoai pham vi truy cap."
        });
        return;
      }

      const installmentSnapshots = ids.map((id) => getInstallmentSnapshotById(id)).filter(Boolean);
      if (installmentSnapshots.length !== ids.length) {
        res.status(404).json({
          Result: -1,
          Message: "Co hop dong khong ton tai trong kho du lieu de luu vao thung rac."
        });
        return;
      }

      const deletedCount = deleteInstallments(ids);
      for (const snapshot of installmentSnapshots) {
        const snapshotId = Number(snapshot.id ?? 0);
        if (!Number.isFinite(snapshotId) || snapshotId <= 0) {
          continue;
        }
        addTrashItem({
          entityType: "installment",
          entityId: snapshotId,
          label:
            String(snapshot.customer_ref || "").trim() ||
            String(snapshot.customer_name || "").trim() ||
            String(snapshot.imei || "").trim() ||
            `Installment #${snapshotId}`,
          payload: snapshot,
          metadata: {
            customerRef: String(snapshot.customer_ref || "").trim(),
            imei: String(snapshot.imei || "").trim(),
            shopId: Number(snapshot.shop_id ?? 0),
            shopName: String(snapshot.shop_name || "")
          },
          deletedBy: user.username
        });
      }
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "installment",
        actionType: "bulk_delete",
        entityType: "installment",
        entityId: ids.join(","),
        description: `Xoa hang loat ${deletedCount} hop dong tra gop`,
        shopId: user.shopId,
        metadata: {
          ids,
          deletedCount
        }
      });
      res.json({
        Result: 1,
        Message: `Da xoa ${deletedCount} hop dong tra gop.`,
        DeletedCount: deletedCount
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Khong the xoa nhieu hop dong tra gop."
      });
    }
  });

  app.post("/installment/api/bulk-status", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      reconcileLegacyInstallmentsForUser(user);
      const ids = parseIdList(req.body.ids);
      const statusCode = parseOptionalNumber(req.body.statusCode);
      const statusText = String(req.body.statusText || "").trim();

      if (ids.length === 0) {
        res.status(400).json({
          Result: -1,
          Message: "Vui long chon it nhat mot hop dong tra gop."
        });
        return;
      }

      if (statusCode === null && !statusText) {
        res.status(400).json({
          Result: -1,
          Message: "Vui long nhap ma trang thai hoac ten trang thai."
        });
        return;
      }

      const installments = ids.map((id) => getInstallmentById(id)).filter(Boolean);
      if (installments.length !== ids.length || installments.some((item) => !requireShopScope(user, item!.shopId))) {
        res.status(403).json({
          Result: -1,
          Message: "Co hop dong khong ton tai hoac nam ngoai pham vi truy cap."
        });
        return;
      }

      const updatedCount = updateInstallmentStatus(ids, statusCode, statusText);
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "installment",
        actionType: "bulk_status",
        entityType: "installment",
        entityId: ids.join(","),
        description: `Cap nhat trang thai cho ${updatedCount} hop dong tra gop`,
        shopId: user.shopId,
        metadata: {
          ids,
          updatedCount,
          statusCode,
          statusText
        }
      });
      res.json({
        Result: 1,
        Message: `Da cap nhat trang thai cho ${updatedCount} hop dong tra gop.`,
        UpdatedCount: updatedCount
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Khong the doi trang thai nhieu hop dong tra gop."
      });
    }
  });

  app.post("/installment/api/progress/:id(\\d+)", requireModulePermission("installment"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      reconcileLegacyInstallmentsForUser(user);
      const installmentId = Number(req.params.id);
      const installment = getInstallmentById(installmentId);
      if (!installment || !requireShopScope(user, installment.shopId)) {
        res.status(403).json({
          Result: -1,
          Message: "Ban khong duoc cap nhat tien do cua hop dong nay."
        });
        return;
      }

      const paidPeriods = Array.isArray(req.body.paidPeriods) ? req.body.paidPeriods : [];
      const updated = updateInstallmentCollectionProgress(installmentId, paidPeriods);
      if (!updated) {
        throw new Error("Khong the cap nhat tien do dong tien.");
      }
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "installment",
        actionType: "update_progress",
        entityType: "installment",
        entityId: updated.id,
        description: `Cap nhat tien do dong tien cho hop dong tra gop ${updated.customerRef || updated.id}`,
        shopId: updated.shopId,
        shopName: updated.shopName,
        metadata: {
          paidPeriods,
          paidBefore: updated.paidBefore,
          paymentDay: updated.paymentDay
        }
      });
      res.json({
        Result: 1,
        Message: "Da cap nhat tien do dong tien.",
        Data: updated
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Khong the cap nhat tien do dong tien."
      });
    }
  });

  app.get("/Shop/Index/", requireModulePermission("shop"), (req: Request, res: Response) => {
    const user = req.session.user!;
    const allowedShopIds = user.canAccessAllShops ? undefined : getAllowedShopIds(user);
    logPageAccess(req, "shop", "Truy cap danh sach cua hang", {
      shopId: user.shopId
    });
    res.render("shop-index", {
      pageTitle: "Cửa hàng",
      activePath: "/Shop/Index/",
      navItems: visibleNavItems(user),
      bootstrap: listShops({ allowedIds: allowedShopIds }),
      canCreateShop: user.canAccessAllShops || user.role === "admin",
      canDeleteShop: user.role === "admin",
      canBulkUpdateShopStatus: user.role === "admin",
      extraStyles: ["/public/shop.css"],
      extraScripts: ["/public/shop.js"],
      inlineScripts: []
    });
  });

  app.get("/Shop/Create", requireModulePermission("shop"), (req: Request, res: Response) => {
    const user = req.session.user!;
    const shopId = parseOptionalNumber(req.query.ShopID);
    const shop = shopId ? getShopById(shopId) : null;

    if (shopId && (!shop || !requireShopScope(user, shopId))) {
      req.session.flash = {
        type: "error",
        title: "Không ủ quyền",
        text: "Bạn không ược truy cập cửa hàng này.",
        mode: "modal"
      };
      res.redirect("/Shop/Index/");
      return;
    }

    if (!shop && !user.canAccessAllShops) {
      req.session.flash = {
        type: "warning",
        title: "Không ủ quyền",
        text: "Tài khoản nhân viên ch0 ược cập nhật cửa hàng ược phân công.",
        mode: "modal"
      };
      res.redirect("/Shop/Index/");
      return;
    }

    logPageAccess(req, "shop", shop ? "Truy cap form cap nhat cua hang" : "Truy cap form tao moi cua hang", {
      shopId: shop?.id ?? user.shopId,
      shopName: shop?.name ?? ""
    });
    res.render("shop-form", {
      pageTitle: shop ? "Cập nhật cửa hàng" : "Thêm mới cửa hàng",
      activePath: shop ? "/Shop/Index/" : "/Shop/Create",
      navItems: visibleNavItems(user),
      formMode: shop ? "edit" : "create",
      shop,
      provinceOptions: listProvinceOptions(),
      canManageAllShops: user.canAccessAllShops,
      extraStyles: ["/public/shop.css"],
      extraScripts: ["/public/shop-form.js"],
      inlineScripts: []
    });
  });

  app.get("/Shop/Edit/:id", requireModulePermission("shop"), (req: Request, res: Response) => {
    const user = req.session.user!;
    const shopId = Number(req.params.id);
    const shop = getShopById(shopId);
    if (!shop || !requireShopScope(user, shopId)) {
      req.session.flash = {
        type: "error",
        title: "Không tìm thấy",
        text: "Ban ghi cua hang khong ton tai.",
        mode: "modal"
      };
      res.redirect("/Shop/Index/");
      return;
    }

    res.redirect(`/Shop/Create?ShopID=${shop.id}`);
  });

  app.post("/Shop/Create", requireModulePermission("shop"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const shopId = parseOptionalNumber(req.body.ShopID);
      if (!shopId && !user.canAccessAllShops) {
        throw new Error("Tai khoan nhan vien khong duoc tao moi cua hang.");
      }
      if (shopId && !requireShopScope(user, shopId)) {
        throw new Error("Ban khong duoc cap nhat cua hang nay.");
      }

      const savedShop = saveShop(req.body, shopId ?? undefined);
      if (!savedShop) {
        throw new Error("Không thỒ lưu cửa hàng.");
      }
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "shop",
        actionType: shopId ? "update" : "create",
        entityType: "shop",
        entityId: savedShop.id,
        description: `${shopId ? "Cap nhat" : "Tao moi"} cua hang ${savedShop.name}`,
        shopId: savedShop.id,
        shopName: savedShop.name,
        metadata: {
          phone: savedShop.phone,
          status: savedShop.status
        }
      });
      req.session.flash = {
        type: "success",
        title: shopId ? "Cập nhật thành công" : "Lưu thành công",
        text: shopId ? "Da cap nhat cua hang." : "Da tao moi cua hang.",
        mode: "toast"
      };
      res.redirect("/Shop/Index/");
    } catch (error) {
      req.session.flash = {
        type: "error",
        title: "Không thỒ lưu",
        text: error instanceof Error ? error.message : "Không thỒ lưu cửa hàng.",
        mode: "modal"
      };

      const shopId = parseOptionalNumber(req.body.ShopID);
      res.redirect(shopId ? `/Shop/Create?ShopID=${shopId}` : "/Shop/Create");
    }
  });

  app.get("/shop/api/list", requireModulePermission("shop"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const result = listShops({
        generalSearch: String(req.query.generalSearch || ""),
        status: parseOptionalNumber(req.query.Status),
        allowedIds: user.canAccessAllShops ? undefined : getAllowedShopIds(user),
        page: Number(req.query.PageCurrent || 1),
        perPage: Number(req.query.PerPageCurrent || 50),
        sortColumn: String(req.query.columnCurrent || "createdDate"),
        sortDirection: String(req.query.sortCurrent || "desc") === "asc" ? "asc" : "desc"
      });

      res.json({
        Result: 1,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Không thỒ tải danh sách cửa hàng"
      });
    }
  });

  app.get("/shop/api/localities/wards", requireModulePermission("shop"), (req: Request, res: Response) => {
    try {
      const provinceCode = String(req.query.provinceCode || "").trim();
      res.json({
        Result: 1,
        items: listWardOptionsByProvinceCode(provinceCode)
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Không thỒ tải danh sách phường xã"
      });
    }
  });

  app.get("/shop/api/transfer-options", requireAdmin, (req: Request, res: Response) => {
    try {
      const excludeIds = parseIdList(req.query.excludeIds);
      const items = getAllShopOptions().filter((item: { id: number }) => !excludeIds.includes(item.id));
      res.json({
        Result: 1,
        items
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Kh?ng th? t?i danh s?ch c?a h?ng nh?n d? li?u"
      });
    }
  });

  app.delete("/shop/api/:id", requireAdmin, (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const shopId = Number(req.params.id);
      const shop = getShopById(shopId);
      if (!shop) {
        res.status(404).json({
          Result: -1,
          Message: "Không tìm thấy cửa hàng Ồ xóa."
        });
        return;
      }

      const shopSnapshot = getShopSnapshotById(shopId);
      if (!shopSnapshot) {
        res.status(404).json({
          Result: -1,
          Message: "Kh?ng t?m th?y d? li?u c?a h?ng ?? l?u v?o th?ng r?c."
        });
        return;
      }

      const transferShopId = parseOptionalNumber(req.body.transferShopId);
      const relatedInstallmentCount = countInstallmentsByShop(shopId);
      const relatedStaffCount = countStaffByShop(shopId);
      const requiresTransfer = relatedInstallmentCount > 0 || relatedStaffCount > 0;

      let transferShop: ReturnType<typeof getShopById> | null = null;
      if (transferShopId) {
        if (transferShopId === shopId) {
          res.status(400).json({
            Result: -1,
            Message: "Kh?ng th? ch?n ch?nh c?a h?ng ?ang x?a l?m n?i nh?n d? li?u."
          });
          return;
        }
        transferShop = getShopById(transferShopId);
        if (transferShop && transferShop.status !== 1) {
          res.status(400).json({
            Result: -1,
            Message: "C?a h?ng nh?n d? li?u ph?i ? tr?ng th?i ?ang ho?t ??ng."
          });
          return;
        }
      }

      if (requiresTransfer && !transferShop) {
        res.status(400).json({
          Result: -1,
          Message: "C?a h?ng n?y ?ang c? d? li?u li?n quan. Vui l?ng ch?n c?a h?ng nh?n d? li?u tr??c khi x?a."
        });
        return;
      }

      const movedInstallments = transferShop ? transferInstallmentsToShop(shopId, transferShop.id, transferShop.name) : 0;
      const movedStaff = transferShop ? reassignStaffToShop(shopId, transferShop.id, transferShop.name) : 0;

      const deleted = deleteShop(shopId);
      if (!deleted) {
        res.status(404).json({
          Result: -1,
          Message: "Kh?ng t?m th?y c?a h?ng ?? x?a."
        });
        return;
      }

      addTrashItem({
        entityType: "shop",
        entityId: shop.id,
        label: shop.name,
        payload: shopSnapshot,
        metadata: {
          transferShopId: transferShop?.id ?? null,
          transferShopName: transferShop?.name ?? "",
          movedInstallments,
          movedStaff
        },
        deletedBy: user.username
      });

      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "shop",
        actionType: "delete",
        entityType: "shop",
        entityId: shop.id,
        description: `Xoa cua hang ${shop.name}`,
        shopId: shop.id,
        shopName: shop.name,
        metadata: {
          phone: shop.phone,
          status: shop.status,
          transferShopId: transferShop?.id ?? null,
          transferShopName: transferShop?.name ?? "",
          relatedInstallmentCount,
          relatedStaffCount,
          movedInstallments,
          movedStaff
        }
      });
      res.json({
        Result: 1,
        Message: transferShop
          ? `Da xoa cua hang. Da chuyen ${movedInstallments} hop dong va ${movedStaff} nhan vien sang ${transferShop.name}.`
          : "Da xoa cua hang."
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Kh?ng th? x?a c?a h?ng"
      });
    }
  });

  app.post("/shop/api/bulk-delete", requireAdmin, (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const ids = parseIdList(req.body.ids);
      if (ids.length === 0) {
        res.status(400).json({
          Result: -1,
          Message: "Vui l?ng ch?n ?t nh?t m?t c?a h?ng."
        });
        return;
      }

      const shops = ids.map((id) => getShopById(id)).filter(Boolean);
      if (shops.length !== ids.length) {
        res.status(404).json({
          Result: -1,
          Message: "Co cua hang khong ton tai."
        });
        return;
      }

      const shopSnapshots = ids.map((id) => getShopSnapshotById(id)).filter(Boolean);
      if (shopSnapshots.length !== ids.length) {
        res.status(404).json({
          Result: -1,
          Message: "Co cua hang khong ton tai trong kho du lieu de luu vao thung rac."
        });
        return;
      }

      const transferShopId = parseOptionalNumber(req.body.transferShopId);
      const relatedInstallmentCount = ids.reduce((total, id) => total + countInstallmentsByShop(id), 0);
      const relatedStaffCount = ids.reduce((total, id) => total + countStaffByShop(id), 0);
      const requiresTransfer = relatedInstallmentCount > 0 || relatedStaffCount > 0;

      let transferShop: ReturnType<typeof getShopById> | null = null;
      if (transferShopId) {
        if (ids.includes(transferShopId)) {
          res.status(400).json({
            Result: -1,
            Message: "Kh?ng th? ch?n c?a h?ng ?ang n?m trong danh s?ch x?a l?m n?i nh?n d? li?u."
          });
          return;
        }
        transferShop = getShopById(transferShopId);
        if (transferShop && transferShop.status !== 1) {
          res.status(400).json({
            Result: -1,
            Message: "C?a h?ng nh?n d? li?u ph?i ? tr?ng th?i ?ang ho?t ??ng."
          });
          return;
        }
      }

      if (requiresTransfer && !transferShop) {
        res.status(400).json({
          Result: -1,
          Message: "Danh s?ch x?a ?ang c? d? li?u li?n quan. Vui l?ng ch?n c?a h?ng nh?n d? li?u tr??c khi x?a."
        });
        return;
      }

      let movedInstallments = 0;
      let movedStaff = 0;
      if (transferShop) {
        for (const id of ids) {
          movedInstallments += transferInstallmentsToShop(id, transferShop.id, transferShop.name);
          movedStaff += reassignStaffToShop(id, transferShop.id, transferShop.name);
        }
      }

      const deletedCount = deleteShops(ids);
      for (const snapshot of shopSnapshots) {
        addTrashItem({
          entityType: "shop",
          entityId: Number(snapshot.id),
          label: String(snapshot.name || ""),
          payload: snapshot,
          metadata: {
            transferShopId: transferShop?.id ?? null,
            transferShopName: transferShop?.name ?? ""
          },
          deletedBy: user.username
        });
      }
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "shop",
        actionType: "bulk_delete",
        entityType: "shop",
        entityId: ids.join(","),
        description: `Xoa hang loat ${deletedCount} cua hang`,
        shopId: user.shopId,
        metadata: {
          ids,
          deletedCount,
          transferShopId: transferShop?.id ?? null,
          transferShopName: transferShop?.name ?? "",
          relatedInstallmentCount,
          relatedStaffCount,
          movedInstallments,
          movedStaff
        }
      });
      res.json({
        Result: 1,
        Message: transferShop
          ? `Da xoa ${deletedCount} cua hang. Da chuyen ${movedInstallments} hop dong va ${movedStaff} nhan vien sang ${transferShop.name}.`
          : `Da xoa ${deletedCount} cua hang.`,
        DeletedCount: deletedCount,
        movedInstallments,
        movedStaff
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Kh?ng th? x?a nhi?u c?a h?ng"
      });
    }
  });

  app.post("/shop/api/bulk-status", requireAdmin, (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const ids = parseIdList(req.body.ids);
      const status = parseOptionalNumber(req.body.status);
      if (ids.length === 0) {
        res.status(400).json({
          Result: -1,
          Message: "Vui l?ng ch?n ?t nh?t m?t c?a h?ng."
        });
        return;
      }

      if (status === null) {
        res.status(400).json({
          Result: -1,
          Message: "Vui lòng chọn trạng thái cần cập nhật."
        });
        return;
      }

      const shops = ids.map((id) => getShopById(id)).filter(Boolean);
      if (shops.length !== ids.length) {
        res.status(404).json({
          Result: -1,
          Message: "Co cua hang khong ton tai."
        });
        return;
      }

      const updatedCount = updateShopStatus(ids, status);
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "shop",
        actionType: "bulk_status",
        entityType: "shop",
        entityId: ids.join(","),
        description: `Cap nhat trang thai cho ${updatedCount} cua hang`,
        shopId: user.shopId,
        metadata: {
          ids,
          updatedCount,
          status: status === 0 ? 0 : 1
        }
      });
      res.json({
        Result: 1,
        Message: `Da cap nhat trang thai cho ${updatedCount} cua hang.`,
        UpdatedCount: updatedCount
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Kh?ng th? ??i tr?ng th?i nhi?u c?a h?ng"
      });
    }
  });

  app.get("/Staff/Index/", requireModulePermission("staff"), (req: Request, res: Response) => {
    const user = req.session.user!;
    const allowedShopIds = user.canAccessAllShops ? undefined : getAllowedShopIds(user);
    logPageAccess(req, "staff", "Truy cap danh sach nhan vien", {
      shopId: user.shopId
    });
    res.render("staff-index", {
      pageTitle: "Nhân viên",
      activePath: "/Staff/Index/",
      navItems: visibleNavItems(user),
      bootstrap: listStaff({ allowedShopIds }),
      shopOptions: getScopedShopOptions(user),
      canManageAllShops: user.canAccessAllShops,
      canCreateStaff: hasModulePermission(user, "staff"),
      canDeleteStaff: hasModulePermission(user, "staff"),
      extraStyles: ["/public/staff.css"],
      extraScripts: ["/public/staff.js"],
      inlineScripts: []
    });
  });

  app.get("/Staff/Create", requireModulePermission("staff"), (req: Request, res: Response) => {
    const user = req.session.user!;
    const staffId = parseOptionalNumber(req.query.StaffID);
    const staff = staffId ? getStaffById(staffId) : null;

    if (staffId && (!staff || !requireShopScope(user, staff.shopId))) {
      req.session.flash = {
        type: "error",
        title: "Không tìm thấy",
        text: "Bản ghi nhân viên không tn tại hoặc bạn không ược truy cập.",
        mode: "modal"
      };
      res.redirect("/Staff/Index/");
      return;
    }

    logPageAccess(req, "staff", staff ? "Truy cap form cap nhat nhan vien" : "Truy cap form tao moi nhan vien", {
      shopId: staff?.shopId ?? user.shopId,
      shopName: staff?.shopName ?? ""
    });
    res.render("staff-form", {
      pageTitle: staff ? "Cập nhật nhân viên" : "Thêm mới nhân viên",
      activePath: staff ? "/Staff/Index/" : "/Staff/Create",
      navItems: visibleNavItems(user),
      formMode: staff ? "edit" : "create",
      staff,
      shopOptions: getScopedShopOptions(user),
      canManageAllShops: user.canAccessAllShops,
      extraStyles: ["/public/staff.css"],
      extraScripts: [],
      inlineScripts: []
    });
  });

  app.post("/Staff/Create", requireModulePermission("staff"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const staffId = parseOptionalNumber(req.body.StaffID);
      const shopId = parseOptionalNumber(req.body.shopId);
      if (!shopId || !requireShopScope(user, shopId)) {
        throw new Error("Bạn không được thao tác nhân viên của cửa hàng này.");
      }

      if (!user.canAccessAllShops) {
        req.body.role = "staff";
        req.body.canAccessAllShops = "0";
        req.body.allowedShopIds = [shopId];
      }

      const savedStaff = saveStaff(req.body, staffId ?? undefined);
      if (!savedStaff) {
        throw new Error("Không thể lưu nhân viên.");
      }
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "staff",
        actionType: staffId ? "update" : "create",
        entityType: "staff",
        entityId: savedStaff.id,
        description: `${staffId ? "Cập nhật" : "Tạo mới"} nhân viên ${savedStaff.username}`,
        shopId: savedStaff.shopId,
        shopName: savedStaff.shopName,
        metadata: {
          role: savedStaff.role,
          status: savedStaff.status
        }
      });
      req.session.flash = {
        type: "success",
        title: staffId ? "Cập nhật thành công" : "Lưu thành công",
        text: staffId ? "Đã cập nhật nhân viên." : "Đã tạo m:i nhân viên.",
        mode: "toast"
      };
      res.redirect("/Staff/Index/");
    } catch (error) {
      req.session.flash = {
        type: "error",
        title: "Không thỒ lưu",
        text: error instanceof Error ? error.message : "Không thỒ lưu nhân viên.",
        mode: "modal"
      };
      const staffId = parseOptionalNumber(req.body.StaffID);
      res.redirect(staffId ? `/Staff/Create?StaffID=${staffId}` : "/Staff/Create");
    }
  });

  app.get("/staff/api/list", requireModulePermission("staff"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const searchShopId = parseOptionalNumber(req.query.SearchShopId);
      if (searchShopId && !requireShopScope(user, searchShopId)) {
        res.status(403).json({
          Result: -1,
          Message: "Ban khong duoc xem nhan vien cua cua hang nay."
        });
        return;
      }

      const result = listStaff({
        generalSearch: String(req.query.generalSearch || ""),
        status: parseOptionalNumber(req.query.Status),
        searchShopId,
        allowedShopIds: user.canAccessAllShops ? undefined : getAllowedShopIds(user),
        page: Number(req.query.PageCurrent || 1),
        perPage: Number(req.query.PerPageCurrent || 50),
        sortColumn: String(req.query.columnCurrent || "createdDate"),
        sortDirection: String(req.query.sortCurrent || "desc") === "asc" ? "asc" : "desc"
      });

      res.json({
        Result: 1,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Không thỒ tải danh sách nhân viên"
      });
    }
  });

  app.get("/staff/api/transfer-options", requireModulePermission("staff"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const excludeIds = parseIdList(req.query.excludeIds);
      const allowedShopIds = user.canAccessAllShops || user.role === "admin" ? undefined : getAllowedShopIds(user);
      const items = getAllActiveStaff(allowedShopIds).filter((item: { id: number }) => !excludeIds.includes(item.id));
      res.json({
        Result: 1,
        items
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Kh?ng th? t?i danh s?ch nh?n vi?n nh?n d? li?u"
      });
    }
  });

  app.delete("/staff/api/:id", requireModulePermission("staff"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const staffId = Number(req.params.id);
      const staff = getStaffById(staffId);
      if (!staff || !requireShopScope(user, staff.shopId)) {
        res.status(404).json({
          Result: -1,
          Message: "Không tìm thấy nhân viên Ồ xóa."
        });
        return;
      }

      const staffSnapshot = getStaffSnapshotById(staffId);
      if (!staffSnapshot) {
        res.status(404).json({
          Result: -1,
          Message: "Kh?ng t?m th?y d? li?u nh?n vi?n ?? l?u v?o th?ng r?c."
        });
        return;
      }

      const transferStaffId = parseOptionalNumber(req.body.transferStaffId);
      const installerNameCandidates = buildStaffInstallerNameCandidates(staff);
      const relatedInstallmentCount = countInstallmentsByInstallerNames(installerNameCandidates);

      let transferStaff: ReturnType<typeof getStaffById> | null = null;
      if (transferStaffId) {
        if (transferStaffId === staffId) {
          res.status(400).json({
            Result: -1,
            Message: "Kh?ng th? ch?n ch?nh nh?n vi?n ?ang x?a l?m ng??i nh?n d? li?u."
          });
          return;
        }
        transferStaff = getStaffById(transferStaffId);
        if (!transferStaff || transferStaff.status !== 1 || !requireShopScope(user, transferStaff.shopId)) {
          res.status(400).json({
            Result: -1,
            Message: "Nh?n vi?n nh?n d? li?u kh?ng h?p l? ho?c n?m ngo?i ph?m vi truy c?p."
          });
          return;
        }
      }

      if (relatedInstallmentCount > 0 && !transferStaff) {
        res.status(400).json({
          Result: -1,
          Message: "Nh?n vi?n n?y ?ang c? d? li?u li?n quan. Vui l?ng ch?n nh?n vi?n nh?n d? li?u tr??c khi x?a."
        });
        return;
      }

      const movedInstallments = transferStaff
        ? transferInstallmentsInstallerNames(installerNameCandidates, resolveStaffDisplayName(transferStaff))
        : 0;

      const deleted = deleteStaff(staffId);
      if (!deleted) {
        res.status(404).json({
          Result: -1,
          Message: "Không tìm thấy nhân viên Ồ xóa."
        });
        return;
      }

      addTrashItem({
        entityType: "staff",
        entityId: staff.id,
        label: `${staff.fullName || staff.username}`,
        payload: staffSnapshot,
        metadata: {
          transferStaffId: transferStaff?.id ?? null,
          transferStaffName: transferStaff ? resolveStaffDisplayName(transferStaff) : "",
          movedInstallments
        },
        deletedBy: user.username
      });

      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "staff",
        actionType: "delete",
        entityType: "staff",
        entityId: staff.id,
        description: `Xoa nhan vien ${staff.username}`,
        shopId: staff.shopId,
        shopName: staff.shopName,
        metadata: {
          role: staff.role,
          status: staff.status,
          relatedInstallmentCount,
          transferStaffId: transferStaff?.id ?? null,
          transferStaffName: transferStaff ? resolveStaffDisplayName(transferStaff) : "",
          movedInstallments
        }
      });
      res.json({
        Result: 1,
        Message: transferStaff
          ? `Da xoa nhan vien. Da chuyen ${movedInstallments} hop dong sang ${resolveStaffDisplayName(transferStaff)}.`
          : "Da xoa nhan vien."
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Không thỒ xóa nhân viên"
      });
    }
  });

  app.post("/staff/api/bulk-delete", requireModulePermission("staff"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const ids = parseIdList(req.body.ids);
      if (ids.length === 0) {
        res.status(400).json({
          Result: -1,
          Message: "Vui l?ng ch?n ?t nh?t m?t nh?n vi?n."
        });
        return;
      }

      const staffItems = ids.map((id) => getStaffById(id)).filter(Boolean);
      if (staffItems.length !== ids.length || staffItems.some((item) => !requireShopScope(user, item!.shopId))) {
        res.status(403).json({
          Result: -1,
          Message: "Co nhan vien khong ton tai hoac nam ngoai pham vi truy cap."
        });
        return;
      }

      const staffSnapshots = ids.map((id) => getStaffSnapshotById(id)).filter(Boolean);
      if (staffSnapshots.length !== ids.length) {
        res.status(404).json({
          Result: -1,
          Message: "Co nhan vien khong ton tai trong kho du lieu de luu vao thung rac."
        });
        return;
      }

      const transferStaffId = parseOptionalNumber(req.body.transferStaffId);
      const allInstallerNames = Array.from(
        new Set(
          staffItems.flatMap((item) => buildStaffInstallerNameCandidates(item as { username?: string; fullName?: string }))
        )
      );
      const relatedInstallmentCount = countInstallmentsByInstallerNames(allInstallerNames);

      let transferStaff: ReturnType<typeof getStaffById> | null = null;
      if (transferStaffId) {
        if (ids.includes(transferStaffId)) {
          res.status(400).json({
            Result: -1,
            Message: "Kh?ng th? ch?n nh?n vi?n n?m trong danh s?ch x?a l?m ng??i nh?n d? li?u."
          });
          return;
        }
        transferStaff = getStaffById(transferStaffId);
        if (!transferStaff || transferStaff.status !== 1 || !requireShopScope(user, transferStaff.shopId)) {
          res.status(400).json({
            Result: -1,
            Message: "Nh?n vi?n nh?n d? li?u kh?ng h?p l? ho?c n?m ngo?i ph?m vi truy c?p."
          });
          return;
        }
      }

      if (relatedInstallmentCount > 0 && !transferStaff) {
        res.status(400).json({
          Result: -1,
          Message: "Danh s?ch x?a ?ang c? d? li?u li?n quan. Vui l?ng ch?n nh?n vi?n nh?n d? li?u tr??c khi x?a."
        });
        return;
      }

      const movedInstallments = transferStaff
        ? transferInstallmentsInstallerNames(allInstallerNames, resolveStaffDisplayName(transferStaff))
        : 0;

      const deletedCount = deleteStaffMany(ids);
      for (const snapshot of staffSnapshots) {
        addTrashItem({
          entityType: "staff",
          entityId: Number(snapshot.id),
          label: String(snapshot.full_name || snapshot.username || ""),
          payload: snapshot,
          metadata: {
            transferStaffId: transferStaff?.id ?? null,
            transferStaffName: transferStaff ? resolveStaffDisplayName(transferStaff) : ""
          },
          deletedBy: user.username
        });
      }
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "staff",
        actionType: "bulk_delete",
        entityType: "staff",
        entityId: ids.join(","),
        description: `Xoa hang loat ${deletedCount} nhan vien`,
        shopId: user.shopId,
        metadata: {
          ids,
          deletedCount,
          relatedInstallmentCount,
          transferStaffId: transferStaff?.id ?? null,
          transferStaffName: transferStaff ? resolveStaffDisplayName(transferStaff) : "",
          movedInstallments
        }
      });
      res.json({
        Result: 1,
        Message: transferStaff
          ? `Da xoa ${deletedCount} nhan vien. Da chuyen ${movedInstallments} hop dong sang ${resolveStaffDisplayName(transferStaff)}.`
          : `Da xoa ${deletedCount} nhan vien.`,
        DeletedCount: deletedCount,
        movedInstallments
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Không thỒ xóa nhiều nhân viên"
      });
    }
  });

  app.post("/staff/api/bulk-status", requireModulePermission("staff"), (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const ids = parseIdList(req.body.ids);
      const status = parseOptionalNumber(req.body.status);
      if (ids.length === 0) {
        res.status(400).json({
          Result: -1,
          Message: "Vui l?ng ch?n ?t nh?t m?t nh?n vi?n."
        });
        return;
      }

      if (status === null) {
        res.status(400).json({
          Result: -1,
          Message: "Vui lòng chọn trạng thái cần cập nhật."
        });
        return;
      }

      const staffItems = ids.map((id) => getStaffById(id)).filter(Boolean);
      if (staffItems.length !== ids.length || staffItems.some((item) => !requireShopScope(user, item!.shopId))) {
        res.status(403).json({
          Result: -1,
          Message: "Co nhan vien khong ton tai hoac nam ngoai pham vi truy cap."
        });
        return;
      }

      const updatedCount = updateStaffStatus(ids, status);
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "staff",
        actionType: "bulk_status",
        entityType: "staff",
        entityId: ids.join(","),
        description: `Cap nhat trang thai cho ${updatedCount} nhan vien`,
        shopId: user.shopId,
        metadata: {
          ids,
          updatedCount,
          status: status === 0 ? 0 : 1
        }
      });
      res.json({
        Result: 1,
        Message: `Da cap nhat trang thai cho ${updatedCount} nhan vien.`,
        UpdatedCount: updatedCount
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Kh?ng th? ??i tr?ng th?i nhi?u nh?n vi?n"
      });
    }
  });

  app.get("/Staff/PermissionStaff/", requireAdmin, (req: Request, res: Response) => {
    const user = req.session.user!;
    const staffId = parseOptionalNumber(req.query.StaffID);
    const selectedStaff = staffId ? getStaffById(staffId) : null;

    logPageAccess(req, "permission", "Truy cap man hinh phan quyen nhan vien", {
      shopId: selectedStaff?.shopId ?? user.shopId,
      shopName: selectedStaff?.shopName ?? ""
    });
    res.render("staff-permission", {
      pageTitle: "Phân quyền nhân viên",
      activePath: "/Staff/PermissionStaff/",
      navItems: visibleNavItems(user),
      staffItems: getAllActiveStaff(),
      selectedStaff,
      shopOptions: getAllShopOptions(),
      extraStyles: ["/public/staff.css"],
      extraScripts: [],
      inlineScripts: []
    });
  });

  app.post("/Staff/PermissionStaff/:id", requireAdmin, (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const updatedStaff = updateStaffPermissions(Number(req.params.id), req.body);
      if (!updatedStaff) {
        throw new Error("Không thỒ cập nhật quyền nhân viên.");
      }
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "permission",
        actionType: "update",
        entityType: "staff_permission",
        entityId: updatedStaff.id,
        description: `Cập nhật phân quyền cho ${updatedStaff.username}`,
        shopId: updatedStaff.shopId,
        shopName: updatedStaff.shopName,
        metadata: {
          role: updatedStaff.role,
          canAccessAllShops: updatedStaff.canAccessAllShops,
          allowedShopIds: updatedStaff.allowedShopIds,
          modulePermissions: updatedStaff.modulePermissions
        }
      });
      req.session.flash = {
        type: "success",
        title: "Cập nhật thành công",
        text: "Đã cập nhật quyền nhân viên.",
        mode: "toast"
      };
    } catch (error) {
      req.session.flash = {
        type: "error",
        title: "Không thỒ phân quyền",
        text: error instanceof Error ? error.message : "Không thỒ cập nhật quyền nhân viên.",
        mode: "modal"
      };
    }

    res.redirect(`/Staff/PermissionStaff/?StaffID=${req.params.id}`);
  });

  app.get("/Trash/Index/", requireAdmin, (req: Request, res: Response) => {
    const user = req.session.user!;
    logPageAccess(req, "trash", "Truy cap thung rac", {
      shopId: user.shopId
    });

    res.render("trash-index", {
      pageTitle: "Thùng rác",
      activePath: "/Trash/Index/",
      navItems: visibleNavItems(user),
      extraStyles: ["/public/trash.css"],
      extraScripts: ["/public/trash.js"],
      inlineScripts: []
    });
  });

  app.get("/trash/api/list", requireAdmin, (req: Request, res: Response) => {
    try {
      const result = listTrashItems({
        entityType: String(req.query.entityType || ""),
        generalSearch: String(req.query.generalSearch || ""),
        includeRestored: parseBooleanFlag(req.query.includeRestored),
        page: Number(req.query.page || 1),
        perPage: Number(req.query.perPage || 50)
      });
      res.json({
        Result: 1,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Không thỒ tải danh sách thùng rác"
      });
    }
  });

  app.post("/trash/api/restore/:id", requireAdmin, (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const trashId = Number(req.params.id);
      const trashItem = getTrashItemById(trashId);
      if (!trashItem) {
        res.status(404).json({
          Result: -1,
          Message: "Không tìm thấy bản ghi trong thùng rác."
        });
        return;
      }

      if (String(trashItem.restoredAt || "").trim()) {
        res.status(400).json({
          Result: -1,
          Message: "Ban ghi nay da duoc khoi phuc truoc do."
        });
        return;
      }

      const snapshot =
        trashItem.payload && typeof trashItem.payload === "object" ? (trashItem.payload as Record<string, unknown>) : {};

      let restoredRecord: unknown;
      if (trashItem.entityType === "shop") {
        restoredRecord = restoreShopFromSnapshot(snapshot);
      } else if (trashItem.entityType === "staff") {
        const snapshotShopId = Number(snapshot.shop_id ?? snapshot.shopId ?? 0);
        if (Number.isFinite(snapshotShopId) && snapshotShopId > 0 && !getShopById(snapshotShopId)) {
          res.status(400).json({
            Result: -1,
            Message: "Không thỒ khôi phục nhân viên vì cửa hàng gc chưa tn tại. Hãy khôi phục cửa hàng trư:c."
          });
          return;
        }
        restoredRecord = restoreStaffFromSnapshot(snapshot);
      } else if (trashItem.entityType === "installment") {
        const snapshotShopId = Number(snapshot.shop_id ?? snapshot.shopId ?? 0);
        if (Number.isFinite(snapshotShopId) && snapshotShopId > 0 && !getShopById(snapshotShopId)) {
          res.status(400).json({
            Result: -1,
            Message: "Không thỒ khôi phục hợp ng vì cửa hàng gc chưa tn tại. Hãy khôi phục cửa hàng trư:c."
          });
          return;
        }
        restoredRecord = restoreInstallmentFromSnapshot(snapshot);
      } else {
        res.status(400).json({
          Result: -1,
          Message: `Loai du lieu ${trashItem.entityType} chua ho tro khoi phuc.`
        });
        return;
      }

      const marked = markTrashItemRestored(trashItem.id);
      if (!marked) {
        throw new Error("Không thỒ cập nhật trạng thái khôi phục trong thùng rác.");
      }

      const restoredRecordShopId =
        restoredRecord && typeof restoredRecord === "object" && "shopId" in restoredRecord
          ? Number((restoredRecord as { shopId?: unknown }).shopId)
          : null;
      const restoredRecordShopName =
        restoredRecord && typeof restoredRecord === "object" && "shopName" in restoredRecord
          ? String((restoredRecord as { shopName?: unknown }).shopName || "")
          : "";
      const entityLabel =
        trashItem.entityType === "shop"
          ? "cua hang"
          : trashItem.entityType === "staff"
            ? "nhan vien"
            : trashItem.entityType === "installment"
              ? "hop dong tra gop"
              : "ban ghi";
      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "trash",
        actionType: "restore",
        entityType: `${trashItem.entityType}_restore`,
        entityId: trashItem.entityId,
        description: `Khoi phuc ${entityLabel} tu thung rac`,
        shopId:
          Number.isFinite(Number(restoredRecordShopId)) && Number(restoredRecordShopId) > 0
            ? Number(restoredRecordShopId)
            : user.shopId,
        shopName: restoredRecordShopName,
        metadata: {
          trashItemId: trashItem.id,
          entityType: trashItem.entityType,
          entityId: trashItem.entityId
        }
      });

      res.json({
        Result: 1,
        Message: `Da khoi phuc ${entityLabel} thanh cong.`,
        item: restoredRecord
      });
    } catch (error) {
      res.status(500).json({
        Result: -1,
        Message: error instanceof Error ? error.message : "Kh?ng th? kh?i ph?c d? li?u t? th?ng r?c"
      });
    }
  });

  for (const page of remoteModulePages) {
    if (
      page.pathname === "/Installment/Index/" ||
      page.pathname === "/Installment/Create" ||
      page.pathname === "/Shop/Index/" ||
      page.pathname === "/Shop/Create" ||
      page.pathname === "/Staff/Index/" ||
      page.pathname === "/Staff/Create" ||
      page.pathname === "/Staff/PermissionStaff/" ||
      page.pathname === "/Trash/Index/"
    ) {
      continue;
    }
    const pagePermission = resolveModulePermissionFromPagePath(page.pathname);
    const guard = page.adminOnly
      ? requireAdmin
      : pagePermission
        ? requireModulePermission(pagePermission)
        : requireAdmin;
    app.get(page.pathname, guard, async (req: Request, res: Response) => {
      const moduleName = page.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "remote";
      logPageAccess(req, moduleName, `Truy cap trang ${page.title}`, {
        shopId: req.session.user?.shopId
      });
      await renderRemotePage(req, res, page.pathname, page.title);
    });
  }

  app.get("/History/Export", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.session.user!;
      const filters = buildHistoryFilters(user, req.query);
      const scopedShopId = resolveScopedHistoryShopId(user, parseOptionalNumber(req.query.shopId));
      const exportItems = listAuditLogsForExport(filters);

      safeWriteAuditLogFromRequest(user, req, {
        moduleName: "history",
        actionType: "export",
        entityType: "audit_log",
        entityId: "history-export",
        description: `Xuất Excel l9ch sử thao tác (${exportItems.length} bản ghi)`,
        shopId: scopedShopId ?? user.shopId,
        metadata: {
          totalRows: exportItems.length,
          filters: {
            generalSearch: filters.generalSearch,
            moduleName: filters.moduleName,
            actionType: filters.actionType,
            actorUsername: filters.actorUsername,
            shopId: scopedShopId,
            fromDate: filters.fromDate,
            toDate: filters.toDate
          }
        }
      });

      const rows = exportItems.map((item: ReturnType<typeof listAuditLogsForExport>[number]) => ({
        "Thời gian": item.createdAt ? item.createdAt.replace("T", " ") : "",
        "Người dùng": item.actorDisplayName || item.actorUsername || "",
        "Tài khoản": item.actorUsername || "",
        "Vai trò": item.actorRole || "",
        "Cửa hàng": item.shopName || "",
        "ID cửa hàng": item.shopId ?? "",
        Module: item.moduleName || "",
        "Thao tác": item.actionType || "",
        "Phương thức": item.method || "",
        "Đường dẫn": item.path || "",
        "Loại thực thỒ": item.entityType || "",
        "ID thực thỒ": item.entityId || "",
        "N?i dung": item.description || "",
        "Đ9a ch0 IP": item.ipAddress || ""
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, "LichSuThaoTac");

      const fileBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "buffer"
      });

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="lich-su-thao-tac-${timestamp}.xlsx"`);
      res.send(fileBuffer);
    } catch (error) {
      req.session.flash = {
        type: "error",
        title: "Không thỒ xuất Excel",
        text: error instanceof Error ? error.message : "Kh?ng th? xu?t d? li?u l?ch s? thao t?c.",
        mode: "modal"
      };
      res.redirect("/History/");
    }
  });

  app.get("/History/", requireAuth, async (req: Request, res: Response) => {
    const user = req.session.user!;
    const scopedShopId = resolveScopedHistoryShopId(user, parseOptionalNumber(req.query.shopId));
    const filters = buildHistoryFilters(user, req.query);

    logPageAccess(req, "history", "Truy cap lich su thao tac", {
      shopId: scopedShopId ?? user.shopId
    });

    const auditLogs = listAuditLogs(filters);
    const viewFilters = {
      ...filters,
      shopId: scopedShopId ?? 0
    };
    const shopOptions = getScopedShopOptions(user);
    const installerOptions = getInstallerOptions(user);
    const buildPageUrl = (pageNumber: number) => {
      const queryString = buildHistoryQueryString({
        ...viewFilters,
        page: pageNumber
      });
      return queryString ? `/History/?${queryString}` : "/History/";
    };
    const exportHistoryUrl = (() => {
      const queryString = buildHistoryQueryString(viewFilters);
      return queryString ? `/History/Export?${queryString}` : "/History/Export";
    })();
    res.render("history", {
      pageTitle: "L9ch sử thao tác",
      activePath: "/History/",
      navItems: visibleNavItems(user),
      auditLogs,
      filters: viewFilters,
      shopOptions,
      buildPageUrl,
      exportHistoryUrl,
      extraStyles: ["/public/history.css"],
      extraScripts: [],
      inlineScripts: []
    });
  });

  app.get("/debug/module-apis", requireAuth, (req: Request, res: Response) => {
    res.json({
      Result: 1,
      Data: moduleApiGroups
    });
  });

  return app;
}


