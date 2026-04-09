const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const demoDataDir = path.join(rootDir, "tmp", "doc-data");
const demoMetaPath = path.join(demoDataDir, "demo-meta.json");

process.env.APP_DATA_DIR = demoDataDir;
fs.rmSync(demoDataDir, { recursive: true, force: true });
fs.mkdirSync(demoDataDir, { recursive: true });

const remote2gold = require(path.join(rootDir, "dist", "services", "remote2gold"));
const { listProvinceOptions, listWardOptionsByProvinceCode } = require(path.join(rootDir, "dist", "services", "localities"));
const { saveShop } = require(path.join(rootDir, "dist", "services", "shop-store"));
const { saveStaff } = require(path.join(rootDir, "dist", "services", "staff-store"));
const { saveInstallment } = require(path.join(rootDir, "dist", "services", "installment-store"));
const { writeAuditLog } = require(path.join(rootDir, "dist", "services", "audit-log-store"));
const { createApp } = require(path.join(rootDir, "dist", "app"));

remote2gold.loginTo2Gold = async (username, password) => {
  if (password !== "secret") {
    throw new Error("Sai tai khoan hoac mat khau");
  }

  if (username === "staff01") {
    return {
      user: {
        id: 101,
        username,
        displayName: "Nhân viên Demo",
        role: "staff",
        shopId: 1,
        allowedShopIds: [1],
        canAccessAllShops: false,
        modulePermissions: ["installment", "shop"],
        token: "token-staff01",
        cookieHeader: "auth=staff01",
        menus: []
      },
      message: "Dang nhap thanh cong"
    };
  }

  return {
    user: {
      id: 1,
      username,
      displayName: "Quản trị Demo",
      role: "admin",
      shopId: 1,
      allowedShopIds: [],
      canAccessAllShops: true,
      modulePermissions: ["installment", "shop", "staff"],
      token: "token-admin",
      cookieHeader: "auth=admin",
      menus: []
    },
    message: "Dang nhap thanh cong"
  };
};

remote2gold.fetchMoneyData = async () => ({
  MoneyEndDate: 420000000,
  TotalMoneyInvestment: 425000000,
  TotalContract: 18,
  TotalInterestEarn: 36200000,
  PawnOpen: 4,
  LoanOpen: 3,
  InstallmentOpen: 11
});

remote2gold.fetchRecentActions = async () => [
  {
    StrTime: "09:15",
    Username: "admin",
    ActionName: "Cap nhat hop dong",
    CustomerName: "Nguyễn Văn A",
    TotalMoney: 9800000
  },
  {
    StrTime: "10:20",
    Username: "staff01",
    ActionName: "Tao cua hang",
    CustomerName: "Cửa hàng Quận 7",
    TotalMoney: 175000000
  }
];

remote2gold.fetchRemotePage = async (pathname) => ({
  title: pathname === "/Installment/Index/" ? "Tra gop" : "2Gold",
  subheaderHtml: "",
  contentHtml:
    pathname === "/Installment/Index/"
      ? '<div class="m-content"><div class="m-portlet"><div class="m-portlet__body"><h3>Tong quan demo</h3><p>Day la du lieu tong quan noi bo phuc vu tai lieu huong dan.</p></div></div></div>'
      : '<div class="m-content"><div class="m-portlet"><div class="m-portlet__body"><h3>Trang demo</h3></div></div></div>',
  hiddenInputsHtml: "",
  extraStyles: [],
  extraScripts: [],
  inlineScripts: []
});

function seedDemoData() {
  const province = listProvinceOptions()[0];
  const ward = province ? listWardOptionsByProvinceCode(province.code)[0] : null;

  if (!province || !ward) {
    throw new Error("Khong tim thay du lieu tinh thanh mau.");
  }

  const shopA = saveShop({
    name: "Cửa hàng Trung tâm",
    phone: "0909000001",
    represent: "Trần Minh Việt",
    totalMoney: "250000000",
    createdDate: "2026-04-01",
    status: "1",
    addressDetail: "12 Nguyễn Huệ",
    provinceCode: province.code,
    districtName: "Quận trung tâm",
    wardCode: ward.code
  });

  const shopB = saveShop({
    name: "Cửa hàng Quận 7",
    phone: "0909000002",
    represent: "Lê Thu Hà",
    totalMoney: "175000000",
    createdDate: "2026-04-02",
    status: "1",
    addressDetail: "88 Nguyễn Thị Thập",
    provinceCode: province.code,
    districtName: "Quận 7",
    wardCode: ward.code
  });

  const staffAdmin = saveStaff({
    username: "admin",
    remoteUserId: "1",
    fullName: "Quản trị Demo",
    email: "admin@example.com",
    phone: "0909000099",
    createdDate: "2026-04-01",
    shopId: String(shopA.id),
    status: "1",
    workAddress: "Văn phòng điều hành",
    role: "admin",
    canAccessAllShops: "1",
    allowedShopIds: [],
    modulePermissions: ["installment", "shop", "staff"]
  });

  const staffA = saveStaff({
    username: "staff01",
    remoteUserId: "101",
    fullName: "Nhân viên cửa hàng A",
    email: "staff01@example.com",
    phone: "0909000003",
    createdDate: "2026-04-03",
    shopId: String(shopA.id),
    status: "1",
    workAddress: "Làm việc tại cửa hàng trung tâm",
    role: "staff",
    canAccessAllShops: "0",
    allowedShopIds: [String(shopA.id)],
    modulePermissions: ["installment", "shop"]
  });

  const staffB = saveStaff({
    username: "staff02",
    remoteUserId: "102",
    fullName: "Nhân viên cửa hàng B",
    email: "staff02@example.com",
    phone: "0909000004",
    createdDate: "2026-04-03",
    shopId: String(shopB.id),
    status: "0",
    workAddress: "Làm việc tại cửa hàng quận 7",
    role: "staff",
    canAccessAllShops: "0",
    allowedShopIds: [String(shopB.id)],
    modulePermissions: ["installment"]
  });

  const installmentA1 = saveInstallment({
    shopId: shopA.id,
    stt: "1",
    loanDate: "2026-04-03",
    customerRef: "5550301 Nguyễn Văn A",
    imei: "353000111111111",
    loanPackage: "7500000",
    revenue: "9800000",
    setupFee: "350000",
    netDisbursement: "4920000",
    paidBefore: "1800000",
    paymentDay: "10",
    loanDays: "50",
    installmentAmount: "190000",
    note: "Khách VIP",
    installerName: "Nam",
    referralFee: "0",
    mc: "",
    statusCode: "1",
    statusText: "Dang theo doi"
  });

  const installmentA2 = saveInstallment({
    shopId: shopA.id,
    stt: "2",
    loanDate: "2026-04-04",
    customerRef: "5550302 Trần Thị B",
    imei: "353000222222222",
    loanPackage: "6200000",
    revenue: "7900000",
    setupFee: "250000",
    netDisbursement: "4010000",
    paidBefore: "1500000",
    paymentDay: "7",
    loanDays: "35",
    installmentAmount: "170000",
    note: "Đổi máy",
    installerName: "Na",
    referralFee: "0",
    mc: "",
    statusCode: "2",
    statusText: "Da cap nhat"
  });

  const installmentB1 = saveInstallment({
    shopId: shopB.id,
    stt: "3",
    loanDate: "2026-04-04",
    customerRef: "5550303 Lê Quốc C",
    imei: "353000333333333",
    loanPackage: "5400000",
    revenue: "6800000",
    setupFee: "220000",
    netDisbursement: "3560000",
    paidBefore: "1200000",
    paymentDay: "10",
    loanDays: "40",
    installmentAmount: "165000",
    note: "Kh mới",
    installerName: "Hà",
    referralFee: "0",
    mc: "MC07",
    statusCode: "1",
    statusText: "Dang theo doi"
  });

  const now = new Date().toISOString();
  [
    {
      actorUserId: staffAdmin.id,
      actorUsername: "admin",
      actorDisplayName: "Quản trị Demo",
      actorRole: "admin",
      shopId: shopA.id,
      shopName: shopA.name,
      moduleName: "auth",
      actionType: "login",
      method: "POST",
      path: "/login",
      entityType: "session",
      entityId: "admin",
      description: "Dang nhap thanh cong voi tai khoan admin",
      ipAddress: "127.0.0.1",
      createdAt: now
    },
    {
      actorUserId: staffAdmin.id,
      actorUsername: "admin",
      actorDisplayName: "Quản trị Demo",
      actorRole: "admin",
      shopId: shopA.id,
      shopName: shopA.name,
      moduleName: "shop",
      actionType: "create",
      method: "POST",
      path: "/Shop/Create",
      entityType: "shop",
      entityId: String(shopB.id),
      description: `Tao moi cua hang ${shopB.name}`,
      ipAddress: "127.0.0.1",
      createdAt: now
    },
    {
      actorUserId: staffAdmin.id,
      actorUsername: "admin",
      actorDisplayName: "Quản trị Demo",
      actorRole: "admin",
      shopId: shopA.id,
      shopName: shopA.name,
      moduleName: "installment",
      actionType: "update",
      method: "POST",
      path: `/Installment/Edit/${installmentA2.id}`,
      entityType: "installment",
      entityId: String(installmentA2.id),
      description: `Cap nhat hop dong tra gop ${installmentA2.customerRef}`,
      ipAddress: "127.0.0.1",
      createdAt: now
    },
    {
      actorUserId: staffAdmin.id,
      actorUsername: "admin",
      actorDisplayName: "Quản trị Demo",
      actorRole: "admin",
      shopId: shopA.id,
      shopName: shopA.name,
      moduleName: "staff",
      actionType: "update",
      method: "POST",
      path: `/Staff/PermissionStaff/${staffA.id}`,
      entityType: "staff",
      entityId: String(staffA.id),
      description: `Cap nhat phan quyen cho ${staffA.username}`,
      ipAddress: "127.0.0.1",
      createdAt: now
    }
  ].forEach((entry) => writeAuditLog(entry));

  const meta = {
    shops: [shopA.id, shopB.id],
    staff: {
      adminId: staffAdmin.id,
      staffAId: staffA.id,
      staffBId: staffB.id
    },
    installments: [installmentA1.id, installmentA2.id, installmentB1.id]
  };
  fs.writeFileSync(demoMetaPath, JSON.stringify(meta, null, 2));
}

seedDemoData();

const app = createApp();
const port = Number(process.env.DOC_DEMO_PORT || 3100);

app.listen(port, () => {
  console.log(`DOC_DEMO_SERVER_READY:${port}`);
  console.log(`DOC_DEMO_META:${demoMetaPath}`);
});

