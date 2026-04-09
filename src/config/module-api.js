"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moduleApiGroups = void 0;
exports.moduleApiGroups = [
    {
        module: "installment",
        pagePaths: [
            "/Installment/Index/",
            "/Installment/Create",
            "/Installment/PaymentSchedule",
            "/Installment/CloseInstallment",
            "/Installment/GraveInstallment"
        ],
        apiEndpoints: [
            "/Loan/ListLoan",
            "/Loan/GetLoanByID",
            "/Loan/AddOrUpdateLoan",
            "/Loan/GetHistoryPayment",
            "/Loan/ChangePayNeed",
            "/Loan/ReloadTransationPayment",
            "/Loan/ChangeNextDate",
            "/Loan/GetHistoryNextDateByLoanID",
            "/Loan/ActionCloseInstallment",
            "/Loan/ReLendingInstallment",
            "/PaymentNotify/NotePayment",
            "/PaymentNotify/GetDataNotePayment",
            "/Customer/AddOrUpdateCustomer",
            "/CashByDate/GetDataEachDay"
        ],
        mvcEndpoints: ["/Print/PrintInstallment", "/Print/InstallmentReceipts"]
    },
    {
        module: "shop",
        pagePaths: ["/Shop/Index/", "/Shop/Create"],
        apiEndpoints: [
            "/Shop/List",
            "/Shop/DeleteShop",
            "/Shop/AllShopActive",
            "/Shop/ListMoneyNewDate",
            "/Shop/MoneyForShop",
            "/Shop/ProcessMoneyNewDate",
            "/Shop/GetNotiShopById",
            "/Shop/WebSummaryReportShop",
            "/CashByDate/GetDataEachDay"
        ],
        mvcEndpoints: ["/Shop/ChangeShop"]
    },
    {
        module: "staff",
        pagePaths: ["/Staff/Index/", "/Staff/Create"],
        apiEndpoints: [
            "/Staff/List",
            "/Staff/DeleteStaff",
            "/Staff/AllStaffActive",
            "/Staff/AllOwnerStaffActive",
            "/Shop/AllShopActive"
        ]
    },
    {
        module: "permission",
        pagePaths: ["/Staff/PermissionStaff/"],
        apiEndpoints: [
            "/Staff/GetById",
            "/Staff/PermissionStaff",
            "/Staff/AddPermissionStaff",
            "/Staff/AddPermissionShop",
            "/Staff/GetListShopStaff",
            "/Staff/AllStaffActive",
            "/Shop/AllShopActive"
        ]
    }
];
