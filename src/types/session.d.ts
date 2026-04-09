import "express-session";

export type AppUserRole = "admin" | "staff";

export interface AppSessionUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
  shopId: number;
  allowedShopIds: number[];
  canAccessAllShops: boolean;
  modulePermissions: string[];
  token: string;
  cookieHeader: string;
  menus: unknown[];
}

export interface AppFlashMessage {
  type?: "success" | "error" | "warning" | "info";
  title?: string;
  text?: string;
  mode?: "modal" | "toast" | "login-success";
  username?: string;
  confirmButtonText?: string;
  timer?: number;
}

declare module "express-session" {
  interface SessionData {
    user?: AppSessionUser;
    flash?: AppFlashMessage;
  }
}
