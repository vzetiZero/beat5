"use strict";

const { listProvinceOptions, listWardOptionsByProvinceCode } = require("../src/services/localities");
const { getAllShopOptions, saveShop } = require("../src/services/shop-store");
const { listInstallments, saveInstallment } = require("../src/services/installment-store");

function ensureShop(definition, province, ward) {
  const existing = getAllShopOptions().find((item) => item.name === definition.name);
  return saveShop(
    {
      name: definition.name,
      addressDetail: definition.addressDetail,
      districtName: definition.districtName,
      provinceCode: province.code,
      wardCode: ward.code,
      phone: definition.phone,
      represent: definition.represent,
      totalMoney: definition.totalMoney,
      status: 1,
      createdDate: definition.createdDate
    },
    existing ? existing.id : undefined
  );
}

function ensureInstallments(shop, prefix, installerName) {
  const existing = listInstallments({ searchShopId: shop.id, page: 1, perPage: 200 }).items;
  let createdCount = 0;

  for (let index = 0; index < 5; index += 1) {
    const sequence = index + 1;
    const customerRef = `${prefix}${String(sequence).padStart(2, "0")} Khach demo ${shop.name}`;
    if (existing.some((item) => item.customerRef === customerRef)) {
      continue;
    }

    const loanPackage = 3000000 + sequence * 250000;
    const totalInterest = Math.round(loanPackage * (0.18 + index * 0.015));
    const loanDays = 30 + index * 10;
    const collectionIntervalDays = index % 2 === 0 ? 5 : 7;
    const paidBefore = index === 0 ? 0 : Math.round((loanPackage + totalInterest) * 0.1);

    saveInstallment({
      shopId: shop.id,
      customerRef,
      imei: `${prefix}-IMEI-${sequence}`,
      loanDate: `2026-04-${String(3 + index).padStart(2, "0")}`,
      loanPackage,
      revenue: loanPackage + totalInterest,
      setupFee: 0,
      netDisbursement: loanPackage,
      paidBefore,
      loanDays,
      collectionIntervalDays,
      note: `Hop dong demo ${sequence} cho ${shop.name}`,
      installerName,
      referralFee: 0,
      mc: `${prefix}-MC-${sequence}`,
      statusCode: 1,
      statusText: "Dang theo doi",
      paymentMethod: "periodic"
    });

    createdCount += 1;
  }

  return createdCount;
}

function main() {
  const province = listProvinceOptions()[0];
  if (!province) {
    throw new Error("Khong tim thay tinh/thanh de seed du lieu.");
  }

  const ward = listWardOptionsByProvinceCode(province.code)[0];
  if (!ward) {
    throw new Error("Khong tim thay phuong/xa de seed du lieu.");
  }

  const shopDefinitions = [
    {
      name: "Demo Shop A",
      addressDetail: "12 Nguyen Hue",
      districtName: "Quan 1",
      phone: "0900000001",
      represent: "Tran Demo A",
      totalMoney: 150000000,
      createdDate: "2026-04-01",
      prefix: "A",
      installerName: "Nhan vien Demo A"
    },
    {
      name: "Demo Shop B",
      addressDetail: "88 Le Loi",
      districtName: "Quan 3",
      phone: "0900000002",
      represent: "Tran Demo B",
      totalMoney: 185000000,
      createdDate: "2026-04-02",
      prefix: "B",
      installerName: "Nhan vien Demo B"
    }
  ];

  let createdShopCount = 0;
  let createdInstallmentCount = 0;

  for (const definition of shopDefinitions) {
    const before = getAllShopOptions().find((item) => item.name === definition.name);
    const shop = ensureShop(definition, province, ward);
    if (!before) {
      createdShopCount += 1;
    }
    createdInstallmentCount += ensureInstallments(shop, definition.prefix, definition.installerName);
  }

  console.log(
    JSON.stringify(
      {
        createdShopCount,
        createdInstallmentCount,
        totalShops: getAllShopOptions().length
      },
      null,
      2
    )
  );
}

main();
