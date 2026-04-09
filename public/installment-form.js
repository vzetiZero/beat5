(function () {
  var form = document.querySelector(".installment-form-portlet form");
  if (!form) {
    return;
  }

  var elements = {
    shopSelect: form.querySelector('select[name="shopId"]'),
    installerSelect: form.querySelector('#installerName'),
    customerRef: form.querySelector('input[name="customerRef"]'),
    revenue: form.querySelector('input[name="revenue"]'),
    loanPackage: form.querySelector('input[name="loanPackage"]'),
    paymentMethod: form.querySelector('select[name="paymentMethod"]'),
    loanDays: form.querySelector('input[name="loanDays"]'),
    collectionIntervalDays: form.querySelector('input[name="collectionIntervalDays"]'),
    loanDate: form.querySelector('input[name="loanDate"]'),
    collectInAdvance: form.querySelector('input[name="collectInAdvance"]'),
    note: form.querySelector('textarea[name="note"]'),
    paidBefore: form.querySelector('input[name="paidBefore"]'),
    installmentAmount: form.querySelector('input[name="installmentAmount"]'),
    paymentDay: form.querySelector('input[name="paymentDay"]'),
    prepaidPeriodCount: form.querySelector('input[name="prepaidPeriodCount"]'),
    dailyAmount: document.getElementById("installmentDailyAmount"),
    dueDate: document.getElementById("installmentDueDate"),
    periodCount: document.getElementById("installmentPeriodCount"),
    prepaidSummary: document.getElementById("installmentPrepaidSummary"),
    remainingPeriods: document.getElementById("installmentRemainingPeriods"),
    previewCaption: document.getElementById("installmentPreviewCaption"),
    previewList: document.getElementById("installmentPreviewList")
  };

  function parseMoney(value) {
    var digits = String(value == null ? "" : value).replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("vi-VN") + " VN?";
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }
    var date = new Date(value + "T00:00:00");
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString("vi-VN");
  }

  function addDays(isoDate, days) {
    if (!isoDate) {
      return "";
    }
    var date = new Date(isoDate + "T00:00:00");
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    date.setDate(date.getDate() + Number(days || 0));
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function buildSchedule() {
    var totalRevenue = parseMoney(elements.revenue && elements.revenue.value);
    var loanDays = Math.max(0, Number(elements.loanDays && elements.loanDays.value || 0));
    var intervalDays = Math.max(0, Number(elements.collectionIntervalDays && elements.collectionIntervalDays.value || 0));
    var loanDate = String(elements.loanDate && elements.loanDate.value || "").trim();
    var prepaidPeriods = elements.collectInAdvance && elements.collectInAdvance.checked ? 1 : 0;

    if (!totalRevenue || !loanDays || !intervalDays || !loanDate) {
      return {
        schedule: [],
        totalRevenue: totalRevenue,
        loanDays: loanDays,
        intervalDays: intervalDays,
        prepaidPeriods: prepaidPeriods,
        dueDate: ""
      };
    }

    var safeIntervalDays = Math.min(intervalDays, loanDays);
    var totalPeriods = Math.max(1, Math.ceil(loanDays / safeIntervalDays));
    var baseAmount = Math.floor(totalRevenue / totalPeriods);
    var remainder = totalRevenue - baseAmount * totalPeriods;
    var schedule = [];

    for (var index = 0; index < totalPeriods; index += 1) {
      var startDay = index * safeIntervalDays;
      var endDay = Math.min(loanDays, (index + 1) * safeIntervalDays);
      schedule.push({
        periodIndex: index + 1,
        dueDate: addDays(loanDate, endDay),
        amount: baseAmount + (index < remainder ? 1 : 0),
        isPrepaid: index < prepaidPeriods,
        coveredDays: Math.max(1, endDay - startDay)
      });
    }

    return {
      schedule: schedule,
      totalRevenue: totalRevenue,
      loanDays: loanDays,
      intervalDays: safeIntervalDays,
      prepaidPeriods: prepaidPeriods,
      dueDate: addDays(loanDate, loanDays)
    };
  }

  function renderSchedule() {
    var computed = buildSchedule();
    var schedule = computed.schedule;
    var unpaidSchedule = schedule.filter(function (item) {
      return !item.isPrepaid;
    });
    var paidBefore = schedule
      .filter(function (item) {
        return item.isPrepaid;
      })
      .reduce(function (total, item) {
        return total + Number(item.amount || 0);
      }, 0);

    if (elements.dailyAmount) {
      elements.dailyAmount.textContent = computed.loanDays > 0 ? formatMoney(Math.round(computed.totalRevenue / computed.loanDays)) : "0 VNĐ";
    }
    if (elements.dueDate) {
      elements.dueDate.textContent = formatDate(computed.dueDate);
    }
    if (elements.periodCount) {
      elements.periodCount.textContent = String(schedule.length);
    }
    if (elements.prepaidSummary) {
      elements.prepaidSummary.textContent = String(computed.prepaidPeriods) + " kỳ";
    }
    if (elements.remainingPeriods) {
      elements.remainingPeriods.textContent = String(unpaidSchedule.length) + " kỳ";
    }
    if (elements.previewCaption) {
      elements.previewCaption.textContent = schedule.length
        ? "Mỗi " + computed.intervalDays + " ngày đóng 1 lần"
        : "Chưa có dữ liệu";
    }

    if (elements.installmentAmount) {
      elements.installmentAmount.value = schedule.length ? String(schedule[0].amount) : "0";
    }
    if (elements.paidBefore) {
      elements.paidBefore.value = String(paidBefore);
    }
    if (elements.prepaidPeriodCount) {
      elements.prepaidPeriodCount.value = String(computed.prepaidPeriods);
    }
    if (elements.paymentDay) {
      elements.paymentDay.value = unpaidSchedule.length ? unpaidSchedule[0].dueDate : "";
    }

    if (!elements.previewList) {
      return;
    }

    if (!schedule.length) {
      elements.previewList.innerHTML = '<div class="installment-preview__empty">Nhập đủ Trả góp, Thời gian vay, Số ngày đóng tiền và Ngày vay để xem lịch thu.</div>';
      return;
    }

    elements.previewList.innerHTML = schedule
      .map(function (item) {
        return (
          '<div class="installment-preview__item' +
          (item.isPrepaid ? " is-prepaid" : "") +
          '">' +
          '<div>' +
          '<strong>Kỳ ' +
          item.periodIndex +
          " (" +
          item.coveredDays +
          " ngày)" +
          "</strong>" +
          '<div class="installment-preview__meta">Đến hạn: ' +
          formatDate(item.dueDate) +
          "</div>" +
          "</div>" +
          '<div class="installment-preview__amount">' +
          formatMoney(item.amount) +
          (item.isPrepaid ? '<span class="installment-preview__badge">Đã thu trước</span>' : "") +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function syncInstallerOptions() {
    if (!elements.shopSelect || !elements.installerSelect) {
      return;
    }

    var selectedShopId = String(elements.shopSelect.value || "").trim();
    var currentInstaller = String(elements.installerSelect.value || "").trim();
    var options = Array.from(elements.installerSelect.options);
    var hasVisibleSelection = false;

    options.forEach(function (option, index) {
      if (index === 0) {
        option.hidden = false;
        option.disabled = false;
        return;
      }

      var optionShopId = String(option.getAttribute("data-shop-id") || "0").trim();
      var isVisible = !selectedShopId || optionShopId === "0" || optionShopId === selectedShopId;
      option.hidden = !isVisible;
      option.disabled = !isVisible;

      if (isVisible && option.value === currentInstaller) {
        hasVisibleSelection = true;
      }
    });

    if (!hasVisibleSelection) {
      var firstVisible = options.find(function (option, index) {
        return index > 0 && !option.disabled;
      });
      elements.installerSelect.value = firstVisible ? firstVisible.value : "";
    }
  }

  [elements.revenue, elements.loanDays, elements.collectionIntervalDays, elements.loanDate, elements.collectInAdvance].forEach(function (element) {
    if (!element) {
      return;
    }
    element.addEventListener("input", renderSchedule);
    element.addEventListener("change", renderSchedule);
  });

  if (elements.shopSelect) {
    elements.shopSelect.addEventListener("change", syncInstallerOptions);
  }

  syncInstallerOptions();
  renderSchedule();
})();
