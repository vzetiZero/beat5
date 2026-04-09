const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const testDataDir = path.join(process.cwd(), "tmp", "pw-delete-smoke-data");
  process.env.APP_DATA_DIR = testDataDir;
  fs.rmSync(testDataDir, { recursive: true, force: true });

  const remote2gold = require("../dist/services/remote2gold");
  const { createApp } = require("../dist/app");
  const { listProvinceOptions, listWardOptionsByProvinceCode } = require("../dist/services/localities");
  const { saveShop, getShopById } = require("../dist/services/shop-store");
  const { saveStaff } = require("../dist/services/staff-store");
  const { saveInstallment, countInstallmentsByShop } = require("../dist/services/installment-store");

  const province = listProvinceOptions()[0];
  const ward = province ? listWardOptionsByProvinceCode(province.code)[0] : null;
  if (!province || !ward) {
    throw new Error("Khong tim thay du lieu tinh/xa de tao test data.");
  }

  const now = Date.now();
  const sourceShopName = `PW-Delete-Source-${now}`;
  const targetShopName = `PW-Delete-Target-${now}`;

  const sourceShop = saveShop({
    name: sourceShopName,
    addressDetail: "So 1 Duong A",
    provinceCode: province.code,
    districtName: "Quan Test",
    wardCode: ward.code,
    phone: "0900000001",
    represent: "Nguoi A",
    totalMoney: 1000000,
    status: 1,
    createdDate: "2026-04-06"
  });
  const targetShop = saveShop({
    name: targetShopName,
    addressDetail: "So 2 Duong B",
    provinceCode: province.code,
    districtName: "Quan Test",
    wardCode: ward.code,
    phone: "0900000002",
    represent: "Nguoi B",
    totalMoney: 2000000,
    status: 1,
    createdDate: "2026-04-06"
  });

  if (!sourceShop || !targetShop) {
    throw new Error("Khong tao duoc du lieu shop test.");
  }

  saveStaff({
    username: `pwstaff_${now}`,
    password: "Pw123456!",
    fullName: "PW Staff Source",
    email: "pwstaff@example.com",
    phone: "0900111122",
    workAddress: "Lam viec tai source",
    shopId: sourceShop.id,
    status: 1,
    createdDate: "2026-04-06",
    role: "staff",
    canAccessAllShops: "0",
    allowedShopIds: [sourceShop.id],
    modulePermissions: ["installment", "shop"]
  });

  saveInstallment({
    stt: 1,
    shopId: sourceShop.id,
    loanDate: "2026-04-06",
    customerRef: `PWKH${now} Khach Hang`,
    imei: `IMEI${now}`,
    loanPackage: 8000000,
    revenue: 10000000,
    setupFee: 200000,
    netDisbursement: 7800000,
    paidBefore: 500000,
    paymentDay: 10,
    loanDays: 30,
    installmentAmount: 300000,
    note: "Playwright delete smoke",
    installerName: "PW Staff Source",
    referralFee: 0,
    mc: "PW",
    statusCode: 1,
    statusText: "Dang theo doi"
  });

  remote2gold.loginTo2Gold = async (username) => ({
    user: {
      id: 1,
      username: String(username || "admin"),
      displayName: "PW Admin",
      role: "admin",
      shopId: sourceShop.id,
      allowedShopIds: [],
      canAccessAllShops: true,
      modulePermissions: ["installment", "shop", "staff"],
      token: "pw-token",
      cookieHeader: "",
      menus: []
    },
    message: "Dang nhap test thanh cong"
  });

  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let successPopupText = "";
  page.on("dialog", async (dialog) => {
    const message = dialog.message() || "";
    if (dialog.type() === "prompt" && message.includes("Chon cua hang nhan du lieu")) {
      await dialog.accept(String(targetShop.id));
      return;
    }
    if (dialog.type() === "confirm" && message.includes("Ban muon xoa cua hang")) {
      await dialog.accept();
      return;
    }
    if (dialog.type() === "alert") {
      successPopupText = message.replace(/\s+/g, " ").trim();
      await dialog.accept();
      return;
    }
    await dialog.dismiss();
  });

  async function handleCustomDeleteFlow() {
    try {
      await page.waitForSelector(".app-dialog-root.is-open", { timeout: 2200 });
    } catch (error) {
      return false;
    }

    const firstDialog = page.locator(".app-dialog-root.is-open").first();
    const selectInput = firstDialog.locator(".app-dialog-field__control").first();
    if (await selectInput.count()) {
      await selectInput.selectOption(String(targetShop.id));
    }
    await firstDialog.locator(".app-dialog-btn--confirm").click();

    await page.waitForSelector(".app-dialog-root.is-open .app-dialog-btn--confirm", { timeout: 8000 });
    const secondDialog = page.locator(".app-dialog-root.is-open").first();
    await secondDialog.locator(".app-dialog-btn--confirm").click();

    await page.waitForSelector(".app-dialog-root.is-open .app-dialog-title", { timeout: 10000 });
    const finalDialog = page.locator(".app-dialog-root.is-open").first();
    const titleText = await finalDialog.locator(".app-dialog-title").innerText();
    const messageText = await finalDialog.locator(".app-dialog-message").innerText().catch(() => "");
    successPopupText = `${titleText} ${messageText}`.replace(/\s+/g, " ").trim();
    await finalDialog.locator(".app-dialog-btn--confirm").click();
    return true;
  }
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="Username"]', "admin");
    await page.fill('input[name="Password"]', "secret");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/Installment/Index/**", { timeout: 15000 });

    await page.goto(`${baseUrl}/Shop/Index/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#shopTableBody tr", { timeout: 15000 });
    await page.waitForSelector(".js-delete-shop", { timeout: 15000 });

    const targetRowDeleteButton = page
      .locator("#shopTableBody tr", { hasText: sourceShopName })
      .locator(".js-delete-shop")
      .first();
    await targetRowDeleteButton.click();
    await handleCustomDeleteFlow();
    await page.waitForFunction(
      (name) => {
        const rows = Array.from(document.querySelectorAll("#shopTableBody tr"));
        return !rows.some((row) => (row.textContent || "").includes(name));
      },
      sourceShopName,
      { timeout: 10000 }
    );
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }

  const deletedShop = getShopById(sourceShop.id);
  if (deletedShop) {
    throw new Error("Test fail: Shop nguon chua bi xoa.");
  }

  const movedToTarget = countInstallmentsByShop(targetShop.id);
  if (movedToTarget <= 0) {
    throw new Error("Test fail: Du lieu installment chua duoc chuyen sang shop dich.");
  }

  if (!/Da xoa/i.test(successPopupText)) {
    throw new Error(`Test fail: Khong bat duoc thong bao xoa thanh cong. Popup="${successPopupText}"`);
  }

  console.log("PLAYWRIGHT_DELETE_SMOKE: PASS");
  console.log(`Deleted source shop: ${sourceShopName} (id=${sourceShop.id})`);
  console.log(`Transfer target shop: ${targetShopName} (id=${targetShop.id})`);
  console.log(`Success popup: ${successPopupText}`);
}

main().catch((error) => {
  console.error("PLAYWRIGHT_DELETE_SMOKE: FAIL");
  console.error(error);
  process.exit(1);
});
