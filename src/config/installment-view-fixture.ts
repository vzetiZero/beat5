type InstallmentScheduleFixture = {
  id: number;
  fromDate: string;
  toDate: string;
  paymentDate: string;
  amount: number;
  remaining: number;
  paid: boolean;
  statusText: string;
};

type InstallmentHistoryFixture = {
  time: string;
  actor: string;
  action: string;
  note: string;
};

type InstallmentItemFixture = {
  id: number;
  stt: number;
  customerRef: string;
  shopId: number;
  shopName: string;
  loanPackage: number;
  revenue: number;
  installerName: string;
  loanDate: string;
  dueDate: string;
  paymentDay: string;
  paidBefore: number;
  installmentAmount: number;
  loanDays: number;
  collectionIntervalDays: number;
  note: string;
  mc: string;
  statusCode: number;
  statusText: string;
  dueStatus: "normal" | "due_soon" | "due_today" | "overdue";
  dueInDays?: number;
  currentPeriod?: {
    amountRemaining?: number;
  };
  schedules: InstallmentScheduleFixture[];
  history: InstallmentHistoryFixture[];
  nextDateHistory: InstallmentHistoryFixture[];
};

const shopOptions = [
  { id: 1, name: "Chi nhánh An Nam 1" },
  { id: 2, name: "Chi nhánh An Nam 2" },
  { id: 3, name: "Chi nhánh An Nam 3" }
];

const baseItems: InstallmentItemFixture[] = [
  {
    id: 6780,
    stt: 55501999,
    customerRef: "55501999 Fai iP13",
    shopId: 1,
    shopName: "Chi nhánh An Nam 1",
    loanPackage: 5100000,
    revenue: 6640000,
    installerName: "annammedia6789",
    loanDate: "2025-06-10",
    dueDate: "2025-07-20",
    paymentDay: "2025-07-10",
    paidBefore: 3320000,
    installmentAmount: 1660000,
    loanDays: 40,
    collectionIntervalDays: 10,
    note: "iPhone 13, màu xanh, bản 128GB",
    mc: "MC-AN-1001",
    statusCode: 2,
    statusText: "Quá hạn",
    dueStatus: "overdue",
    schedules: [
      {
        id: 30478,
        fromDate: "2025-06-10",
        toDate: "2025-06-19",
        paymentDate: "2025-06-10",
        amount: 1660000,
        remaining: 0,
        paid: true,
        statusText: "Đã đóng"
      },
      {
        id: 30479,
        fromDate: "2025-06-20",
        toDate: "2025-06-29",
        paymentDate: "2025-06-20",
        amount: 1660000,
        remaining: 0,
        paid: true,
        statusText: "Đã đóng"
      },
      {
        id: 30480,
        fromDate: "2025-06-30",
        toDate: "2025-07-09",
        paymentDate: "",
        amount: 1660000,
        remaining: 1660000,
        paid: false,
        statusText: "Quá hạn 277 ngày"
      },
      {
        id: 30481,
        fromDate: "2025-07-10",
        toDate: "2025-07-19",
        paymentDate: "",
        amount: 1660000,
        remaining: 1660000,
        paid: false,
        statusText: "Quá hạn 267 ngày"
      }
    ],
    history: [
      {
        time: "2025-06-10 09:14",
        actor: "annammedia6789",
        action: "Tạo hợp đồng",
        note: "Khởi tạo hợp đồng trả góp cho khách Fai iP13."
      },
      {
        time: "2025-06-20 15:30",
        actor: "annammedia6789",
        action: "Thu tiền kỳ 2",
        note: "Khách thanh toán đủ 1.660.000 VNĐ."
      }
    ],
    nextDateHistory: [
      {
        time: "2025-07-01 08:00",
        actor: "annammedia6789",
        action: "Đổi ngày thu",
        note: "Đổi ngày phải đóng sang 10/07/2025."
      }
    ]
  },
  {
    id: 6781,
    stt: 55502011,
    customerRef: "Trần Minh Khang",
    shopId: 1,
    shopName: "Chi nhánh An Nam 1",
    loanPackage: 8200000,
    revenue: 9600000,
    installerName: "linh.tran",
    loanDate: "2025-07-01",
    dueDate: "2025-08-10",
    paymentDay: "2025-07-31",
    paidBefore: 4800000,
    installmentAmount: 2400000,
    loanDays: 40,
    collectionIntervalDays: 10,
    note: "Samsung S24 Ultra, thu theo 10 ngày.",
    mc: "MC-AN-1002",
    statusCode: 1,
    statusText: "Đang thu",
    dueStatus: "due_today",
    schedules: [
      {
        id: 30482,
        fromDate: "2025-07-01",
        toDate: "2025-07-10",
        paymentDate: "2025-07-10",
        amount: 2400000,
        remaining: 0,
        paid: true,
        statusText: "Đã đóng"
      },
      {
        id: 30483,
        fromDate: "2025-07-11",
        toDate: "2025-07-20",
        paymentDate: "2025-07-20",
        amount: 2400000,
        remaining: 0,
        paid: true,
        statusText: "Đã đóng"
      },
      {
        id: 30484,
        fromDate: "2025-07-21",
        toDate: "2025-07-30",
        paymentDate: "",
        amount: 2400000,
        remaining: 2400000,
        paid: false,
        statusText: "Đến hạn hôm nay"
      },
      {
        id: 30485,
        fromDate: "2025-07-31",
        toDate: "2025-08-10",
        paymentDate: "",
        amount: 2400000,
        remaining: 2400000,
        paid: false,
        statusText: "Chờ kỳ sau"
      }
    ],
    history: [
      {
        time: "2025-07-01 11:22",
        actor: "linh.tran",
        action: "Tạo hợp đồng",
        note: "Khách mới, hồ sơ đầy đủ."
      }
    ],
    nextDateHistory: []
  },
  {
    id: 6782,
    stt: 55502048,
    customerRef: "Nguyễn Thảo Vy",
    shopId: 2,
    shopName: "Chi nhánh An Nam 2",
    loanPackage: 4500000,
    revenue: 5400000,
    installerName: "hung.nguyen",
    loanDate: "2025-07-05",
    dueDate: "2025-08-14",
    paymentDay: "2025-08-04",
    paidBefore: 1350000,
    installmentAmount: 1350000,
    loanDays: 40,
    collectionIntervalDays: 10,
    note: "Oppo Reno 12, khách hẹn thu tại nhà.",
    mc: "MC-AN-1003",
    statusCode: 1,
    statusText: "Sắp đến hạn",
    dueStatus: "due_soon",
    schedules: [
      {
        id: 30486,
        fromDate: "2025-07-05",
        toDate: "2025-07-14",
        paymentDate: "2025-07-14",
        amount: 1350000,
        remaining: 0,
        paid: true,
        statusText: "Đã đóng"
      },
      {
        id: 30487,
        fromDate: "2025-07-15",
        toDate: "2025-07-24",
        paymentDate: "",
        amount: 1350000,
        remaining: 1350000,
        paid: false,
        statusText: "Đến hạn trong 2 ngày"
      },
      {
        id: 30488,
        fromDate: "2025-07-25",
        toDate: "2025-08-03",
        paymentDate: "",
        amount: 1350000,
        remaining: 1350000,
        paid: false,
        statusText: "Chờ kỳ sau"
      },
      {
        id: 30489,
        fromDate: "2025-08-04",
        toDate: "2025-08-14",
        paymentDate: "",
        amount: 1350000,
        remaining: 1350000,
        paid: false,
        statusText: "Chờ kỳ sau"
      }
    ],
    history: [
      {
        time: "2025-07-16 10:05",
        actor: "hung.nguyen",
        action: "Gọi nhắc đóng tiền",
        note: "Khách xác nhận sẽ đóng đúng hẹn."
      }
    ],
    nextDateHistory: []
  },
  {
    id: 6783,
    stt: 55502061,
    customerRef: "Phạm Quốc Bảo",
    shopId: 2,
    shopName: "Chi nhánh An Nam 2",
    loanPackage: 3200000,
    revenue: 3840000,
    installerName: "hung.nguyen",
    loanDate: "2025-06-18",
    dueDate: "2025-07-18",
    paymentDay: "2025-07-18",
    paidBefore: 3840000,
    installmentAmount: 1280000,
    loanDays: 30,
    collectionIntervalDays: 10,
    note: "Khách đã tất toán đủ.",
    mc: "MC-AN-1004",
    statusCode: 3,
    statusText: "Hoàn thành",
    dueStatus: "normal",
    schedules: [
      {
        id: 30490,
        fromDate: "2025-06-18",
        toDate: "2025-06-27",
        paymentDate: "2025-06-27",
        amount: 1280000,
        remaining: 0,
        paid: true,
        statusText: "Đã đóng"
      },
      {
        id: 30491,
        fromDate: "2025-06-28",
        toDate: "2025-07-07",
        paymentDate: "2025-07-07",
        amount: 1280000,
        remaining: 0,
        paid: true,
        statusText: "Đã đóng"
      },
      {
        id: 30492,
        fromDate: "2025-07-08",
        toDate: "2025-07-18",
        paymentDate: "2025-07-18",
        amount: 1280000,
        remaining: 0,
        paid: true,
        statusText: "Đã đóng"
      }
    ],
    history: [
      {
        time: "2025-07-18 17:12",
        actor: "hung.nguyen",
        action: "Tất toán",
        note: "Hợp đồng đã được đóng."
      }
    ],
    nextDateHistory: []
  },
  {
    id: 6784,
    stt: 55502110,
    customerRef: "Lê Ngọc Hà",
    shopId: 3,
    shopName: "Chi nhánh An Nam 3",
    loanPackage: 6900000,
    revenue: 8200000,
    installerName: "hoa.le",
    loanDate: "2025-07-12",
    dueDate: "2025-08-31",
    paymentDay: "2025-08-01",
    paidBefore: 2050000,
    installmentAmount: 2050000,
    loanDays: 50,
    collectionIntervalDays: 10,
    note: "MacBook Air, giữ hộp máy.",
    mc: "MC-AN-1005",
    statusCode: 1,
    statusText: "Đang thu",
    dueStatus: "normal",
    schedules: [
      {
        id: 30493,
        fromDate: "2025-07-12",
        toDate: "2025-07-21",
        paymentDate: "2025-07-21",
        amount: 2050000,
        remaining: 0,
        paid: true,
        statusText: "Đã đóng"
      },
      {
        id: 30494,
        fromDate: "2025-07-22",
        toDate: "2025-07-31",
        paymentDate: "",
        amount: 2050000,
        remaining: 2050000,
        paid: false,
        statusText: "Chờ thu"
      },
      {
        id: 30495,
        fromDate: "2025-08-01",
        toDate: "2025-08-10",
        paymentDate: "",
        amount: 2050000,
        remaining: 2050000,
        paid: false,
        statusText: "Chờ thu"
      },
      {
        id: 30496,
        fromDate: "2025-08-11",
        toDate: "2025-08-20",
        paymentDate: "",
        amount: 2050000,
        remaining: 2050000,
        paid: false,
        statusText: "Chờ thu"
      }
    ],
    history: [
      {
        time: "2025-07-22 08:42",
        actor: "hoa.le",
        action: "Cập nhật ghi chú",
        note: "Khách xin đổi địa điểm thu tiền."
      }
    ],
    nextDateHistory: []
  },
  {
    id: 6785,
    stt: 55502141,
    customerRef: "Đỗ Tiến Dũng",
    shopId: 3,
    shopName: "Chi nhánh An Nam 3",
    loanPackage: 2500000,
    revenue: 3000000,
    installerName: "hoa.le",
    loanDate: "2025-07-15",
    dueDate: "2025-08-14",
    paymentDay: "2025-07-25",
    paidBefore: 0,
    installmentAmount: 1000000,
    loanDays: 30,
    collectionIntervalDays: 10,
    note: "Khách mới, cần gọi trước khi thu.",
    mc: "MC-AN-1006",
    statusCode: 0,
    statusText: "Mới tạo",
    dueStatus: "due_soon",
    schedules: [
      {
        id: 30497,
        fromDate: "2025-07-15",
        toDate: "2025-07-24",
        paymentDate: "",
        amount: 1000000,
        remaining: 1000000,
        paid: false,
        statusText: "Sắp đến hạn"
      },
      {
        id: 30498,
        fromDate: "2025-07-25",
        toDate: "2025-08-03",
        paymentDate: "",
        amount: 1000000,
        remaining: 1000000,
        paid: false,
        statusText: "Chờ kỳ sau"
      },
      {
        id: 30499,
        fromDate: "2025-08-04",
        toDate: "2025-08-14",
        paymentDate: "",
        amount: 1000000,
        remaining: 1000000,
        paid: false,
        statusText: "Chờ kỳ sau"
      }
    ],
    history: [
      {
        time: "2025-07-15 14:40",
        actor: "hoa.le",
        action: "Tạo hợp đồng",
        note: "Dữ liệu mẫu cho rà giao diện."
      }
    ],
    nextDateHistory: []
  }
];

function computeDashboard(items: InstallmentItemFixture[]) {
  const summary: any = items.reduce(
    (summary, item) => {
      summary.totalNetDisbursement += item.loanPackage;
      summary.totalLoanPackage += item.loanPackage;
      summary.totalRevenue += item.revenue;
      summary.totalPaidBefore += item.paidBefore;
      summary.totalInterestEarned += Math.max(0, item.paidBefore - item.loanPackage);
      if (Math.max(0, item.loanPackage - item.paidBefore) > 0) {
        summary.totalLoanOutstanding += item.loanPackage;
      }
      summary.totalPrincipalOutstanding += Math.max(0, item.loanPackage - item.paidBefore);
      summary.totalContracts += 1;
      const overdueDays = item.dueInDays != null && item.dueInDays < 0 ? Math.abs(item.dueInDays) : 0;
      if (overdueDays > 0) {
        const bucketKey = overdueDays <= 3 ? '1-3' : overdueDays <= 7 ? '4-7' : overdueDays <= 30 ? '8-30' : '31+';
        const bucketLabel = overdueDays <= 3 ? 'Quá hạn 1-3 ngày' : overdueDays <= 7 ? 'Quá hạn 4-7 ngày' : overdueDays <= 30 ? 'Quá hạn 8-30 ngày' : 'Quá hạn trên 30 ngày';
        const current = summary.overdueBuckets.get(bucketKey) || { key: bucketKey, label: bucketLabel, count: 0, remainingAmount: 0 };
        current.count += 1;
        current.remainingAmount += item.currentPeriod?.amountRemaining || Math.max(0, item.revenue - item.paidBefore);
        summary.overdueBuckets.set(bucketKey, current);
      }
      const shopId = item.shopId;
      const currentShop = summary.shopAvailability.get(shopId) || {
        shopId,
        shopName: item.shopName,
        totalInvestment: 0,
        totalLoanDisbursed: 0,
        principalOutstanding: 0,
        interestEarned: 0
      };
      currentShop.totalLoanDisbursed += item.loanPackage;
      currentShop.principalOutstanding += Math.max(0, item.loanPackage - item.paidBefore);
      currentShop.interestEarned += Math.max(0, item.paidBefore - item.loanPackage);
      summary.shopAvailability.set(shopId, currentShop);
      return summary;
    },
    {
      totalNetDisbursement: 0,
      totalLoanPackage: 0,
      totalRevenue: 0,
      totalPaidBefore: 0,
      totalInterestEarned: 0,
      totalLoanOutstanding: 0,
      totalPrincipalOutstanding: 0,
      totalLoanDisbursed: 0,
      totalExpectedInterest: 0,
      totalActualCash: 0,
      totalContracts: 0,
      overdueBuckets: new Map(),
      shopAvailability: new Map()
    }
  );
  summary.totalLoanDisbursed = summary.totalLoanPackage;
  summary.totalExpectedInterest = Math.max(0, summary.totalRevenue - summary.totalLoanPackage);
  summary.totalActualCash = 0;
  summary.overdueBuckets = ['1-3', '4-7', '8-30', '31+']
    .map((key) => summary.overdueBuckets.get(key) || null)
    .filter(Boolean);
  summary.shopAvailability = Array.from(summary.shopAvailability.values()).map((shop: any) => {
    const actualCashOnHand = Number(shop.totalInvestment || 0) - Number(shop.principalOutstanding || 0) + Number(shop.interestEarned || 0);
    return {
      ...shop,
      actualCashOnHand,
      availableToLend: Math.max(0, actualCashOnHand)
    };
  });
  return summary;
}

function computeStatusSummary(items: InstallmentItemFixture[]) {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.statusText, (map.get(item.statusText) || 0) + 1);
  }
  return Array.from(map.entries()).map(([statusText, count]) => ({ statusText, count }));
}

export function getInstallmentViewFixture() {
  const items = JSON.parse(JSON.stringify(baseItems)) as InstallmentItemFixture[];
  return {
    shopOptions: JSON.parse(JSON.stringify(shopOptions)) as typeof shopOptions,
    items,
    bootstrap: {
      availableLoanDays: [30, 40, 50, 60, 90],
      availableStatuses: [
        { code: 0, label: "Mới tạo" },
        { code: 1, label: "Đang thu" },
        { code: 2, label: "Quá hạn" },
        { code: 3, label: "Hoàn thành" }
      ],
      statusSummary: computeStatusSummary(items),
      dashboard: computeDashboard(items),
      lastImport: null
    }
  };
}
