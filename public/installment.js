(function () {
  var config = window.__INSTALLMENT_PAGE__ || {};
  var state = {
    generalSearch: '',
    shopId: String(config.defaultShopId || 0),
    status: '',
    dueStatus: String(config.defaultDueStatus || ''),
    loanTime: '0',
    fromDate: '',
    toDate: '',
    page: 1,
    perPage: 50,
    sortColumn: String(config.defaultSortColumn || 'loanDate'),
    sortDirection: String(config.defaultSortDirection || 'desc') === 'asc' ? 'asc' : 'desc',
    items: [],
    total: 0,
    totalPages: 1,
    activeDetailItem: null,
    activeDetailSchedule: [],
    activeEditItem: null,
    deleteId: null,
    tomorrowDueItems: [],
    statusSummary: [],
    previewSummary: null,
    bootstrap: config.bootstrap || {}
  };

  var els = {
    generalSearch: document.getElementById('generalSearch'),
    shopFilter: document.getElementById('shopFilter'),
    statusFilter: document.getElementById('m-search-status'),
    loanTimeFilter: document.getElementById('m-search-loanTime'),
    fromDate: document.getElementById('txtFromDate'),
    toDate: document.getElementById('txtToDate'),
    perPageFilter: document.getElementById('perPageFilter'),
    tableBody: document.getElementById('installmentTableBody'),
    pagerDetail: document.getElementById('installmentPagerDetail'),
    pagination: document.getElementById('installmentPagination'),
    btnGetData: document.getElementById('btnGetData'),
    btnResetSearch: document.getElementById('btnResetSearch'),
    btnViewAllShops: document.getElementById('btnViewAllShops'),
    btnImportExcel: document.getElementById('btnImportExcel'),
    btnExportVisible: document.getElementById('btnExportVisible'),
    btnModalCreate: document.getElementById('btnModalCreate'),
    btnTomorrowDueCheck: document.getElementById('btnTomorrowDueCheck'),
    btnTomorrowInstallmentsInline: document.getElementById('btnTomorrowInstallmentsInline'),
    btnConfirmDeleteInstallment: document.getElementById('btnConfirmDeleteInstallment'),
    btnUpdateNextDate: document.getElementById('btnUpdateNextDate'),
    btnDongHopDongVayHo: document.getElementById('btnDongHopDongVayHo'),
    btnSaveInstallment: document.getElementById('btnSaveInstallment'),
    dashboardReloadLink: document.getElementById('dashboardReloadLink'),
    excelFileInput: document.getElementById('excelFileInput'),
    deleteInstallmentMessage: document.getElementById('deleteInstallmentMessage'),
    duePaymentTableBody: document.getElementById('duePmentTableBody'),
    tomorrowDueMessage: document.getElementById('tomorrowDueMessage'),
    tomorrowDueDateLabel: document.getElementById('tomorrowDueDateLabel'),
    tomorrowDueTableBody: document.getElementById('tomorrowDueTableBody'),
    installmentStatusSummary: document.getElementById('installmentStatusSummary'),
    nextDateInput: document.getElementById('txtUpdate_NextDate'),
    nextDateHistoryTableBody: document.getElementById('nextDateHistoryTableBody'),
    installmentHistoryTableBody: document.getElementById('installmentHistoryTableBody'),
    createForm: document.getElementById('installmentCreateForm'),
    titleFormPawn: document.getElementById('titleFormPawn'),
    popupShopId: document.getElementById('popupShopId'),
    hfId: document.getElementById('hfId'),
    txtCustomer: document.getElementById('txtCustomer'),
    txtCodeID: document.getElementById('txtCodeID'),
    txtTotalMoney: document.getElementById('txtTotalMoney'),
    txtTotalMoneyReceived: document.getElementById('txtTotalMoneyReceived'),
    txtLoanTime: document.getElementById('txtLoanTime'),
    txtFrequency: document.getElementById('txtFrequency'),
    txtStrFromDate: document.getElementById('txtStrFromDate'),
    txtNote: document.getElementById('txtNote'),
    rateTypeSelected: document.getElementById('ratetype-selected'),
    rateTypeInput: document.getElementById('m-select-ratetype_create'),
    rateTypeDisplay: document.getElementById('ratetype-display'),
    rateTypeDropdown: document.getElementById('ratetype-dropdown'),
    staffSelected: document.getElementById('staff-selected'),
    staffInput: document.getElementById('m-select-staff'),
    staffDisplay: document.getElementById('staff-display'),
    staffDropdown: document.getElementById('staff-dropdown'),
    previewTotalInterest: document.getElementById('previewTotalInterest'),
    previewTotalPeriods: document.getElementById('previewTotalPeriods'),
    previewInstallmentAmount: document.getElementById('previewInstallmentAmount'),
    previewFirstPayment: document.getElementById('previewFirstPayment'),
    previewFinalDueDate: document.getElementById('previewFinalDueDate'),
    messageNotUpdate: document.getElementById('messageNotUpdate'),
    cash: document.getElementById('lbl_LoanPawn_MoneyEndDate'),
    investment: document.getElementById('lbl_LoanPawn_MoneyInvestment'),
    interestExpected: document.getElementById('lbl_LoanPawn_InterestExpected'),
    interestEarned: document.getElementById('lbl_LoanPawn_InterestEarned'),
    totalContracts: document.getElementById('lbl_LoanPawn_TotalContracts'),
    closeContractRemaining: document.getElementById('lblDongHD_TotalMoneyCurrent')
  };

  function money(value) {
    return Number(value || 0).toLocaleString('vi-VN');
  }

  function parseMoneyInput(value) {
    var normalized = String(value == null ? '' : value).replace(/[^\d-]/g, '');
    if (!normalized || normalized === '-') return 0;
    var parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function setMoneyInputValue(input, value) {
    if (!input) return;
    input.value = money(parseMoneyInput(value));
  }

  function bindMoneyInput(input) {
    if (!input) return;
    input.addEventListener('input', function () {
      var selectionEnd = input.selectionEnd;
      var digitsBeforeCaret = String(input.value.slice(0, selectionEnd == null ? input.value.length : selectionEnd)).replace(/\D/g, '').length;
      input.value = money(parseMoneyInput(input.value));
      if (typeof input.setSelectionRange === 'function') {
        var cursor = input.value.length;
        var seenDigits = 0;
        for (var index = 0; index < input.value.length; index += 1) {
          if (/\d/.test(input.value.charAt(index))) {
            seenDigits += 1;
          }
          if (seenDigits >= digitsBeforeCaret) {
            cursor = index + 1;
            break;
          }
        }
        input.setSelectionRange(cursor, cursor);
      }
    });
    input.addEventListener('blur', function () {
      input.value = money(parseMoneyInput(input.value));
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function dateText(value) {
    if (!value) return '';
    var raw = String(value).trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      var parts = raw.split('-');
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    }
    return raw;
  }

  function shortDate(value) {
    var formatted = dateText(value);
    var parts = formatted.split('/');
    return parts.length === 3 ? parts[0] + '/' + parts[1] : formatted;
  }

  function toDateValue(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
    var parts = String(value).split('/');
    if (parts.length === 3) return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
    return '';
  }

  function normalizeDate(date) {
    var normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  function addDays(isoDate, daysToAdd) {
    if (!isoDate) return '';
    var parts = String(isoDate).split('-').map(Number);
    if (parts.length !== 3) return '';
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + Number(daysToAdd || 0));
    return date.toISOString().slice(0, 10);
  }

  function daysBetween(fromIsoDate, toIsoDate) {
    if (!fromIsoDate || !toIsoDate) return null;
    var from = normalizeDate(new Date(fromIsoDate));
    var to = normalizeDate(new Date(toIsoDate));
    return Math.round((to.getTime() - from.getTime()) / 86400000);
  }

  function notify(title, text) {
    if (window.AppDialog && typeof window.AppDialog.alert === 'function') {
      window.AppDialog.alert({ title: title, text: text, type: 'info', confirmText: 'Đóng' });
      return;
    }
    window.alert([title, text].filter(Boolean).join('\n'));
  }

  function showModal(id) {
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.modal) {
      window.jQuery(id).modal('show');
      return;
    }
    var node = document.querySelector(id);
    if (node) {
      node.style.display = 'block';
      node.classList.add('show');
    }
  }

  function hideModal(id) {
    if (window.jQuery && window.jQuery.fn && window.jQuery.fn.modal) {
      window.jQuery(id).modal('hide');
      return;
    }
    var node = document.querySelector(id);
    if (node) {
      node.style.display = 'none';
      node.classList.remove('show');
    }
  }

  async function parseJson(response) {
    var text = await response.text();
    if (!text) return {};
    return JSON.parse(text);
  }

  async function request(url, options) {
    var response = await fetch(url, options || {});
    var payload = await parseJson(response);
    if (!response.ok || payload.Result !== 1) {
      throw new Error(payload.Message || 'Yêu cầu không thành công.');
    }
    return payload;
  }

  function getRemainingMoney(item) {
    return Math.max(0, Number(item.revenue || 0) - Number(item.paidBefore || 0));
  }

  function readControls() {
    state.generalSearch = els.generalSearch ? els.generalSearch.value.trim() : '';
    state.shopId = els.shopFilter ? String(els.shopFilter.value || '0') : '0';
    state.status = els.statusFilter ? String(els.statusFilter.value || '') : '';
    if (state.status === '0') state.status = '';
    state.loanTime = els.loanTimeFilter ? String(els.loanTimeFilter.value || '0') : '0';
    state.fromDate = els.fromDate ? String(els.fromDate.value || '') : '';
    state.toDate = els.toDate ? String(els.toDate.value || '') : '';
    state.perPage = Number(els.perPageFilter ? els.perPageFilter.value : 50) || 50;
  }

  function renderCards(dashboard) {
    if (els.cash) els.cash.textContent = money(dashboard.totalShopInvestment || 0);
    if (els.investment) els.investment.textContent = money(dashboard.totalLoanPackage || 0);
    if (els.interestExpected) els.interestExpected.textContent = money((dashboard.totalRevenue || 0) - (dashboard.totalLoanPackage || 0));
    if (els.interestEarned) els.interestEarned.textContent = money(dashboard.totalPaidBefore || 0);
    if (els.totalContracts) els.totalContracts.textContent = money(dashboard.totalContracts || 0);
  }

  function renderSummary(summary) {
    if (!els.installmentStatusSummary) return;
    var items = Array.isArray(summary) ? summary : [];
    if (!items.length) {
      els.installmentStatusSummary.innerHTML = '<span class="m-badge m-badge--wide installment-annam-summary-pill">Chưa có trạng thái</span>';
      return;
    }
    els.installmentStatusSummary.innerHTML = items.map(function (item) {
      return '<span class="m-badge m-badge--wide installment-annam-summary-pill">' + escapeHtml(item.statusText) + ': <b>' + money(item.count) + '</b></span>';
    }).join('');
  }

  function getStatusBadge(item) {
    var statusText = String(item.statusText || '').trim() || 'Quá hạn thanh toán';
    var lower = statusText.toLowerCase();
    var cls = 'm-badge--metal';
    if (lower.indexOf('quá hạn') >= 0 || lower.indexOf('chậm trả') >= 0) cls = 'm-badge--danger';
    else if (lower.indexOf('đến ngày trả góp') >= 0 || lower.indexOf('ngày mai đến ngày') >= 0 || item.dueStatus === 'due_today' || item.dueStatus === 'due_soon') cls = 'm-badge--warning';
    else if (lower.indexOf('đã đóng') >= 0 || lower.indexOf('hoàn thành') >= 0) cls = 'm-badge--success';
    else if (lower.indexOf('đang') >= 0) cls = 'm-badge--info';
    return '<span class="m-badge ' + cls + ' m-badge--wide" style="font-size:12px">' + escapeHtml(statusText) + '</span>';
  }

  function renderCalendarTotalRow(items) {
    if (config.pageMode !== 'calendar' || !Array.isArray(items) || !items.length) return '';
    var totals = items.reduce(function (accumulator, item) {
      accumulator.loanPackage += Number(item.loanPackage || 0);
      accumulator.paidBefore += Number(item.paidBefore || 0);
      accumulator.installmentAmount += Number(item.installmentAmount || 0);
      accumulator.remainingMoney += getRemainingMoney(item);
      return accumulator;
    }, {
      loanPackage: 0,
      paidBefore: 0,
      installmentAmount: 0,
      remainingMoney: 0
    });

    return [
      '<tr class="m-datatable__row installment-annam-total-row">',
      '<td class="m-datatable__cell--center m-datatable__cell"><span style="width:40px;"></span></td>',
      '<td class="m-datatable__cell"><span style="width:90px;"></span></td>',
      '<td class="m-datatable__cell"><span style="width:170px;"><a class="installment-annam-total-label"><b>Tổng Tiền</b></a></span></td>',
      '<td class="m-datatable__cell--right m-datatable__cell"><span class="installment-annam-total-value" style="width:120px;">' + money(totals.loanPackage) + '</span></td>',
      '<td class="m-datatable__cell--left m-datatable__cell"><span style="width:120px;"></span></td>',
      '<td class="m-datatable__cell--center m-datatable__cell"><span style="width:150px;"></span></td>',
      '<td class="m-datatable__cell--right m-datatable__cell"><span class="installment-annam-total-value" style="width:120px;">' + money(totals.paidBefore) + '</span></td>',
      '<td class="m-datatable__cell--right m-datatable__cell"><span class="installment-annam-total-value" style="width:100px;">' + money(totals.installmentAmount) + '</span></td>',
      '<td class="m-datatable__cell--right m-datatable__cell"><span class="installment-annam-total-value" style="width:120px;">' + money(totals.remainingMoney) + '</span></td>',
      '<td class="m-datatable__cell--center m-datatable__cell"><span style="width:110px;"></span></td>',
      '<td class="m-datatable__cell--center m-datatable__cell"><span style="width:110px;"></span></td>',
      '<td class="m-datatable__cell installment-annam-sticky-action"><span style="width:190px;"></span></td>',
      '</tr>'
    ].join('');
  }

  function renderPagination() {
    if (!els.pagination) return;
    if (state.totalPages <= 1) {
      els.pagination.innerHTML = '';
      return;
    }
    var html = [];
    function push(label, page, disabled, active, modifier) {
      html.push('<li><a href="#" class="m-datatable__pager-link ' + (modifier ? 'm-datatable__pager-link--' + modifier + ' ' : '') + (active ? 'm-datatable__pager-link--active ' : '') + (disabled ? 'm-datatable__pager-link--disabled' : '') + '" data-page="' + page + '" ' + (disabled ? 'disabled="disabled"' : '') + '>' + label + '</a></li>');
    }
    push('<i class="la la-angle-double-left"></i>', 1, state.page === 1, false, 'first');
    push('<i class="la la-angle-left"></i>', Math.max(1, state.page - 1), state.page === 1, false, 'prev');
    var start = Math.max(1, state.page - 2);
    var end = Math.min(state.totalPages, state.page + 2);
    for (var page = start; page <= end; page += 1) push(String(page), page, false, page === state.page, 'number');
    push('<i class="la la-angle-right"></i>', Math.min(state.totalPages, state.page + 1), state.page === state.totalPages, false, 'next');
    push('<i class="la la-angle-double-right"></i>', state.totalPages, state.page === state.totalPages, false, 'last');
    els.pagination.innerHTML = html.join('');
  }

  function renderRows(items) {
    if (!els.tableBody) return;
    if (!items.length) {
      var emptyText = config.pageMode === 'calendar' ? 'Chưa có hợp đồng đến hạn thanh toán.' : 'Chưa có dữ liệu hợp đồng.';
      els.tableBody.innerHTML = '<tr class="m-datatable__row"><td colspan="12" class="installment-annam-empty">' + emptyText + '</td></tr>';
      return;
    }
    var html = items.map(function (item, index) {
      var rowNumber = ((state.page - 1) * state.perPage) + index + 1;
      var dueClass = item.dueStatus ? ' installment-annam-row--' + item.dueStatus : '';
      var paidPeriods = Array.isArray(item.collectionProgress) ? item.collectionProgress.length : 0;
      var remainingMoney = getRemainingMoney(item);
      var remainingPeriods = Math.max(0, Math.ceil(remainingMoney / Math.max(1, Number(item.installmentAmount || 1))));
      return [
        '<tr data-id="' + item.id + '" class="m-datatable__row' + dueClass + '">',
        '<td class="m-datatable__cell--center m-datatable__cell"><span style="width:40px;">' + rowNumber + '</span></td>',
        '<td class="m-datatable__cell"><span style="width:90px;"><a class="m-link js-open-detail" data-id="' + item.id + '" style="color:#716aca;cursor:pointer">HD-' + escapeHtml(item.stt || item.id) + '</a></span></td>',
        '<td class="m-datatable__cell"><span style="width:170px;"><div><div class="m-card-user__details"><a class="m-card-user__email m-link font-cusName font-weight-bold js-open-detail" data-id="' + item.id + '" style="color:#27408B;cursor:pointer;">' + escapeHtml(item.customerRef || '') + '</a><div class="installment-annam-shop-hint">' + escapeHtml(item.shopName || '') + '</div></div></div></span></td>',
        '<td class="m-datatable__cell--right m-datatable__cell"><span style="width:120px;">' + money(item.loanPackage) + '</span></td>',
        '<td class="m-datatable__cell--left m-datatable__cell"><span style="width:120px;">' + escapeHtml(item.installerName || '') + '</span></td>',
        '<td class="m-datatable__cell--center m-datatable__cell"><span style="width:150px;"><div class="text-center"><div class="m-card-user__details"><span>' + escapeHtml(shortDate(item.loanDateDisplay || item.loanDate)) + '</span> <i class="la la-arrow-right text-danger font-weight-bold" style="font-size:14px"></i> <span>' + escapeHtml(shortDate(item.dueDateDisplay || item.dueDate)) + '</span><div>(' + escapeHtml(String(item.loanDays || 0)) + ' ngày)</div></div></div></span></td>',
        '<td class="m-datatable__cell--right m-datatable__cell"><span style="width:120px;"><div><div class="m-card-user__details"><span class="m-card-user__name">' + money(item.paidBefore) + '</span><br><a href="#" class="m-card-user__email m-link small">(' + money(paidPeriods) + ' kỳ)</a></div></div></span></td>',
        '<td class="m-datatable__cell--right m-datatable__cell"><span style="width:100px;"><div><div class="m-card-user__details"><span class="m-card-user__name">' + money(item.installmentAmount) + '</span><br><small>/ 1 kỳ</small></div></div></span></td>',
        '<td class="m-datatable__cell--right m-datatable__cell"><span style="width:120px;"><div><div class="m-card-user__details"><span class="m-card-user__name">' + money(remainingMoney) + '</span><br><a href="#" class="m-card-user__email m-link small">(' + money(remainingPeriods) + ' kỳ)</a></div></div></span></td>',
        '<td class="m-datatable__cell--center m-datatable__cell"><span style="width:110px;">' + getStatusBadge(item) + '</span></td>',
        '<td class="m-datatable__cell--center m-datatable__cell"><span style="width:110px;"><a href="#" class="js-open-next-date installment-annam-inline-action" data-id="' + item.id + '" title="Cập nhật ngày đóng"><i class="fa fa-calendar"></i><span>' + escapeHtml(dateText(item.paymentDayDisplay || item.paymentDay || '')) + '</span></a></span></td>',
        '<td class="m-datatable__cell installment-annam-sticky-action"><span style="width:190px;" class="installment-annam-action-group"><button class="btn btn-sm installment-annam-action installment-annam-action--collect js-open-detail" type="button" data-id="' + item.id + '" title="Đóng tiền" aria-label="Đóng tiền"><img src="/public/assets/pay.svg" alt="Đóng tiền" style="width:16px; height:16px;"></button> <button class="btn btn-sm installment-annam-action installment-annam-action--calendar js-open-next-date" type="button" data-id="' + item.id + '" title="Cập nhật ngày đóng" aria-label="Cập nhật ngày đóng"><i class="fa fa-calendar"></i></button> <button class="btn btn-sm installment-annam-action installment-annam-action--edit js-open-edit" type="button" data-id="' + item.id + '" title="Sửa hợp đồng" aria-label="Sửa hợp đồng"><img src="/public/assets/update.svg" alt="Sửa hợp đồng" style="width:16px; height:16px;"></button> <button class="btn btn-sm installment-annam-action installment-annam-action--delete js-open-delete" type="button" data-id="' + item.id + '" title="Xóa hợp đồng" aria-label="Xóa hợp đồng"><img src="/public/assets/delete.svg" alt="Xóa hợp đồng" style="width:16px; height:16px;"></button></span></td>',
        '</tr>'
      ].join('');
    }).join('');
    els.tableBody.innerHTML = html + renderCalendarTotalRow(items);
  }

  function updatePagerDetail() {
    if (!els.pagerDetail) return;
    els.pagerDetail.textContent = 'Tổng số ' + money(state.total) + ' bản ghi - Trang ' + state.page + '/' + state.totalPages;
  }

  function getTomorrowIsoDate() {
    var today = normalizeDate(new Date());
    today.setDate(today.getDate() + 1);
    return today.toISOString().slice(0, 10);
  }

  function buildDetailSchedule(item) {
    var loanDays = Math.max(1, Number(item.loanDays || 0) || 1);
    var intervalDays = Math.max(1, Number(item.collectionIntervalDays || 1) || 1);
    var periods = Math.max(1, Math.ceil(loanDays / intervalDays));
    var revenue = Math.max(0, Number(item.revenue || 0));
    var baseAmount = Math.floor(revenue / periods);
    var remainder = revenue - (baseAmount * periods);
    var progressSet = new Set((Array.isArray(item.collectionProgress) ? item.collectionProgress : []).map(Number));
    var today = new Date().toISOString().slice(0, 10);
    var lastPaidIndex = 0;
    progressSet.forEach(function (value) { if (value > lastPaidIndex) lastPaidIndex = value; });
    var firstUnpaidIndex = lastPaidIndex + 1;
    var rows = [];

    for (var index = 0; index < periods; index += 1) {
      var periodIndex = index + 1;
      var dueDate = addDays(item.loanDate, Math.min(loanDays, (index + 1) * intervalDays));
      var fromDate = index === 0 ? item.loanDate : addDays(item.loanDate, index * intervalDays);
      var amount = baseAmount + (index < remainder ? 1 : 0);
      var paid = progressSet.has(periodIndex);
      var dueDiff = daysBetween(today, dueDate);
      var statusText = 'Chờ thu';
      if (paid) statusText = 'Đã đóng';
      else if (dueDiff !== null && dueDiff < 0) statusText = 'Quá hạn ' + Math.abs(dueDiff) + ' ngày';
      else if (dueDiff === 0) statusText = 'Đến hạn hôm nay';
      else if (dueDiff !== null && dueDiff <= 3) statusText = 'Sắp đến hạn';
      rows.push({
        id: periodIndex,
        periodIndex: periodIndex,
        fromDate: fromDate,
        toDate: dueDate,
        dueDate: dueDate,
        amount: amount,
        paid: paid,
        remaining: paid ? 0 : amount,
        paymentDate: paid ? dueDate : '',
        statusText: statusText,
        canPay: !paid && periodIndex === firstUnpaidIndex,
        canCancel: paid && periodIndex === lastPaidIndex
      });
    }
    return rows;
  }

  function renderHistoryRows() {
    if (!els.installmentHistoryTableBody) return;
    els.installmentHistoryTableBody.innerHTML = '<tr><td colspan="4" class="installment-annam-empty">Lịch sử thao tác chi tiết hiện chưa được lưu riêng. Audit log tổng vẫn hoạt động ở module Lịch sử.</td></tr>';
  }

  function renderNextDateHistoryRows(item) {
    if (!els.nextDateHistoryTableBody) return;
    var currentText = item && (item.paymentDayDisplay || dateText(item.paymentDay));
    els.nextDateHistoryTableBody.innerHTML = '<tr><td>-</td><td>-</td><td>Ngày đang áp dụng</td><td>' + escapeHtml(currentText || 'Chưa có') + '</td></tr>';
  }

  function renderTomorrowDueRows(items) {
    if (!els.tomorrowDueTableBody) return;
    if (!items.length) {
      els.tomorrowDueTableBody.innerHTML = '<tr><td colspan="7" class="installment-annam-empty">Không có hợp đồng nào đến kỳ thanh toán vào ngày mai.</td></tr>';
      return;
    }
    els.tomorrowDueTableBody.innerHTML = items.map(function (item) {
      return '<tr>' +
        '<td>HD-' + escapeHtml(item.stt || item.id) + '</td>' +
        '<td><a href="#" class="js-open-detail font-weight-bold" data-id="' + item.id + '">' + escapeHtml(item.customerRef || '-') + '</a></td>' +
        '<td>' + escapeHtml(item.shopName || '-') + '</td>' +
        '<td class="text-right">' + money(item.installmentAmount || 0) + '</td>' +
        '<td class="text-right">' + money(getRemainingMoney(item)) + '</td>' +
        '<td class="text-center">' + escapeHtml(dateText(item.paymentDayDisplay || item.paymentDay || '')) + '</td>' +
        '<td class="text-center"><button type="button" class="btn btn-sm btn-info js-open-detail" data-id="' + item.id + '">Xem</button></td>' +
      '</tr>';
    }).join('');
  }

  function renderDuePaymentRows(item) {
    if (!els.duePaymentTableBody) return;
    if (!item) {
      els.duePaymentTableBody.innerHTML = '<tr><td colspan="7" class="installment-annam-empty">Không có dữ liệu đến hạn thanh toán.</td></tr>';
      return;
    }
    var dueText = dateText(item.paymentDayDisplay || item.paymentDay || '');
    els.duePaymentTableBody.innerHTML = '<tr>' +
      '<td class="text-center">1</td>' +
      '<td class="text-center">HD-' + escapeHtml(item.stt || item.id) + '</td>' +
      '<td>' + escapeHtml(item.customerRef || '-') + '</td>' +
      '<td class="text-center">' + escapeHtml(dueText || '-') + '</td>' +
      '<td class="text-right">' + money(getRemainingMoney(item)) + '</td>' +
      '<td class="text-center">' + getStatusBadge(item) + '</td>' +
      '<td class="text-center"><button type="button" class="btn btn-secondary btn-sm js-open-next-date" data-id="' + item.id + '" title="Cập nhật ngày đóng"><i class="fa fa-calendar"></i></button></td>' +
    '</tr>';
  }

  function renderScheduleRows(schedule) {
    var tbody = document.querySelector('#tbl_DongTien_list tbody');
    if (!tbody) return;
    tbody.innerHTML = schedule.map(function (row) {
      var actionButton = row.paid
        ? (row.canCancel ? '<button class="btn btn-sm btn-warning js-cancel-schedule" data-period-index="' + row.periodIndex + '"><i class="fa fa-undo"></i> Hủy</button>' : '<button class="btn btn-sm btn-secondary" disabled><i class="fa fa-lock"></i> Đã khóa</button>')
        : (row.canPay ? '<button class="btn btn-sm btn-primary js-pay-schedule" data-period-index="' + row.periodIndex + '"><i class="fa fa-check"></i> Đóng</button>' : '<button class="btn btn-sm btn-secondary" disabled>Chờ kỳ trước</button>');
      var statusBadge = row.paid
        ? '<span class="badge badge-success">Đã đóng</span>'
        : '<span class="badge badge-danger">' + escapeHtml(row.statusText) + '</span>';
      return '<tr data-period-index="' + row.periodIndex + '">' +
        '<td class="text-center">' + row.periodIndex + '</td>' +
        '<td class="text-center">' + escapeHtml(dateText(row.fromDate)) + '</td>' +
        '<td class="text-center">-&gt;</td>' +
        '<td class="text-center">' + escapeHtml(dateText(row.toDate)) + '</td>' +
        '<td class="text-right">' + money(row.amount) + '</td>' +
        '<td class="text-center">' + escapeHtml(dateText(row.paymentDate) || '-') + '</td>' +
        '<td class="text-right">' + money(row.remaining) + '</td>' +
        '<td class="text-center">' + actionButton + '</td>' +
        '<td class="text-left">' + statusBadge + '</td>' +
      '</tr>';
    }).join('');
  }

  function fillDetailModal(item) {
    state.activeDetailItem = item;
    state.activeDetailSchedule = buildDetailSchedule(item);
    document.getElementById('hddLoanID').value = String(item.id || '');
    document.getElementById('hddTotalMoneyCurrent').value = String(getRemainingMoney(item));
    document.getElementById('lblCusName').textContent = item.customerRef || '';
    document.getElementById('lblCusPhone').textContent = item.shopName ? ' - ' + item.shopName : '';
    document.getElementById('lblCusAddress').textContent = item.note ? ' - ' + item.note : '';
    document.getElementById('lblAff').textContent = item.mc ? ' - ' + item.mc : '';
    document.getElementById('lblTotalMoney').textContent = money(item.revenue || 0);
    document.getElementById('lblStrRate').textContent = item.installerName || '';
    document.getElementById('lblFromDate').textContent = dateText(item.loanDateDisplay || item.loanDate);
    document.getElementById('lblToDate').textContent = dateText(item.dueDateDisplay || item.dueDate);
    document.getElementById('lblStatus').innerHTML = getStatusBadge(item);
    document.getElementById('lblTotalMoneyReceived').textContent = money(item.loanPackage || 0);
    document.getElementById('lblTotalMoneyPayment').textContent = money(item.revenue || 0);
    document.getElementById('lblPaymentMoney').textContent = money(item.paidBefore || 0);
    document.getElementById('lblTotalMoneyCurrent').textContent = money(getRemainingMoney(item));
    document.getElementById('lblTotalInterest').textContent = money((item.revenue || 0) - (item.loanPackage || 0));
    document.getElementById('model_pawn_header').textContent = 'Bảng chi tiết Hợp đồng - ' + (item.customerRef || ('HĐ #' + item.id));
    if (els.closeContractRemaining) els.closeContractRemaining.textContent = money(getRemainingMoney(item));
    renderScheduleRows(state.activeDetailSchedule);
    renderDuePaymentRows(item);
    renderHistoryRows();
  }

  async function openTomorrowDueModal() {
    var tomorrowIsoDate = getTomorrowIsoDate();
    if (els.tomorrowDueDateLabel) els.tomorrowDueDateLabel.textContent = 'Ngày mai: ' + dateText(tomorrowIsoDate);
    if (els.tomorrowDueMessage) els.tomorrowDueMessage.textContent = 'Đang kiểm tra danh sách hợp đồng đến kỳ thanh toán vào ngày mai...';
    if (els.tomorrowDueTableBody) els.tomorrowDueTableBody.innerHTML = '<tr><td colspan="7" class="installment-annam-empty">Đang tải dữ liệu...</td></tr>';
    showModal('#modal_tomorrow_due_check');

    var params = new URLSearchParams();
    params.set('generalSearch', '');
    params.set('SearchShopId', state.shopId || '0');
    params.set('Status', '0');
    params.set('LoanTime', '0');
    params.set('FromDate', '');
    params.set('ToDate', '');
    params.set('PageCurrent', '1');
    params.set('PerPageCurrent', '200');
    params.set('columnCurrent', 'paymentDay');
    params.set('sortCurrent', 'asc');
    params.set('DueStatus', 'due_tomorrow');

    try {
      var payload = await request(String(config.listUrl || '/installment/api/list') + '?' + params.toString(), {
        headers: { Accept: 'application/json' }
      });
      var tomorrowItems = Array.isArray(payload.items) ? payload.items : [];
      state.tomorrowDueItems = tomorrowItems.slice();
      renderTomorrowDueRows(tomorrowItems);
      if (els.tomorrowDueMessage) {
        els.tomorrowDueMessage.textContent = tomorrowItems.length
          ? 'Có ' + money(tomorrowItems.length) + ' hợp đồng đến kỳ thanh toán vào ngày mai.'
          : 'Không có hợp đồng nào đến kỳ thanh toán vào ngày mai.';
      }
    } catch (error) {
      state.tomorrowDueItems = [];
      if (els.tomorrowDueMessage) els.tomorrowDueMessage.textContent = 'Không thể kiểm tra danh sách đến kỳ ngày mai.';
      if (els.tomorrowDueTableBody) {
        els.tomorrowDueTableBody.innerHTML = '<tr><td colspan="7" class="installment-annam-empty installment-annam-empty--error">Không thể tải dữ liệu ngày mai.</td></tr>';
      }
      notify('Lỗi kiểm tra ngày mai', error instanceof Error ? error.message : 'Không thể tải dữ liệu ngày mai.');
    }
  }

  function renderInstallerOptions() {
    if (!els.staffDropdown) return;
    var options = Array.isArray(config.installerOptions) ? config.installerOptions : [];
    els.staffDropdown.innerHTML = options.map(function (option) {
      return '<div class="custom-select-option" data-dropdown="staff" data-value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label || option.value) + '</div>';
    }).join('');
  }

  function updatePerCyclePreview() {
    var revenue = parseMoneyInput(els.txtTotalMoney ? els.txtTotalMoney.value : 0);
    var loanDays = Math.max(1, Number(els.txtLoanTime ? els.txtLoanTime.value : 1));
    var intervalDays = Math.max(1, Number(els.txtFrequency ? els.txtFrequency.value : 1));
    var periods = Math.max(1, Math.ceil(loanDays / intervalDays));
    var amount = Math.round(revenue / periods);
    var node = document.getElementById('strMoneyOfLoanTime');
    if (node) node.textContent = money(amount);
  }

  function validateMoneyRelation(payload) {
    if (!payload) return null;
    if (payload.revenue > 0 && payload.loanPackage > 0 && payload.loanPackage >= payload.revenue) {
      return 'Tiền đưa khách phải nhỏ hơn Trả Góp.';
    }
    return null;
  }

  function renderPreview(summary) {
    state.previewSummary = summary || null;
    if (els.previewTotalInterest) els.previewTotalInterest.textContent = money(summary && summary.totalInterest ? summary.totalInterest : 0);
    if (els.previewTotalPeriods) els.previewTotalPeriods.textContent = String(summary && summary.totalPeriods ? summary.totalPeriods : 0);
    if (els.previewInstallmentAmount) els.previewInstallmentAmount.textContent = money(summary && summary.installmentAmount ? summary.installmentAmount : 0);
    if (els.previewFirstPayment) els.previewFirstPayment.textContent = summary && summary.firstPaymentDayDisplay ? summary.firstPaymentDayDisplay : '-';
    if (els.previewFinalDueDate) els.previewFinalDueDate.textContent = summary && summary.finalDueDateDisplay ? summary.finalDueDateDisplay : '-';
    if (!state.activeEditItem && els.txtCodeID && (!els.txtCodeID.value || els.txtCodeID.value === '0') && summary && summary.nextStt) {
      els.txtCodeID.value = String(summary.nextStt);
    }
  }

  function setPopupShopValue(value) {
    if (!els.popupShopId) return;
    var nextValue = String(value || config.contextShopId || config.defaultShopId || '');
    if ((!nextValue || nextValue === '0') && state.shopId && state.shopId !== '0') nextValue = String(state.shopId);
    if ((!nextValue || nextValue === '0') && config.shopOptions && config.shopOptions.length) nextValue = String(config.shopOptions[0].id || config.shopOptions[0].value || '');
    if ((!nextValue || nextValue === '0') && els.popupShopId.options.length) nextValue = String(els.popupShopId.options[0].value || '');
    els.popupShopId.value = nextValue;
  }

  function populateForm(item) {
    state.activeEditItem = item || null;
    if (els.titleFormPawn) els.titleFormPawn.textContent = item ? 'Cập nhật Hợp đồng' : 'Thêm mới Hợp đồng';
    if (els.messageNotUpdate) els.messageNotUpdate.style.display = item ? 'inline' : 'none';
    if (els.hfId) els.hfId.value = item ? String(item.id) : '0';
    if (els.txtCustomer) els.txtCustomer.value = item ? String(item.customerRef || '') : '';
    if (els.txtCodeID) els.txtCodeID.value = item ? String(item.stt || item.id || '') : '';
    if (els.txtTotalMoney) setMoneyInputValue(els.txtTotalMoney, item ? item.revenue || 0 : 0);
    if (els.txtTotalMoneyReceived) setMoneyInputValue(els.txtTotalMoneyReceived, item ? item.loanPackage || 0 : 0);
    if (els.txtLoanTime) els.txtLoanTime.value = item ? String(item.loanDays || 30) : '30';
    if (els.txtFrequency) els.txtFrequency.value = item ? String(item.collectionIntervalDays || 1) : '1';
    if (els.txtStrFromDate) els.txtStrFromDate.value = item ? toDateValue(item.loanDate) : new Date().toISOString().slice(0, 10);
    if (els.txtNote) els.txtNote.value = item ? String(item.note || '') : '';
    if (els.staffInput) els.staffInput.value = item ? String(item.installerName || '') : String((config.installerOptions && config.installerOptions[0] && config.installerOptions[0].value) || '');
    if (els.staffSelected) els.staffSelected.textContent = item ? String(item.installerName || '') : String((config.installerOptions && config.installerOptions[0] && config.installerOptions[0].label) || '');
    if (els.rateTypeInput) els.rateTypeInput.value = '0';
    if (els.rateTypeSelected) els.rateTypeSelected.textContent = 'Theo ngày';
    setPopupShopValue(item ? item.shopId : (state.shopId !== '0' ? state.shopId : (config.contextShopId || config.defaultShopId)));
    updatePerCyclePreview();
    queuePreview();
  }

  function buildMutationPayload() {
    var activeItem = state.activeEditItem;
    var popupShopId = els.popupShopId ? Number(els.popupShopId.value || 0) : 0;
    if (!popupShopId || popupShopId <= 0) {
      popupShopId = Number(state.shopId || 0) || Number(config.contextShopId || 0) || Number(config.defaultShopId || 0);
    }
    if ((!popupShopId || popupShopId <= 0) && config.shopOptions && config.shopOptions.length) {
      popupShopId = Number(config.shopOptions[0].id || config.shopOptions[0].value || 0);
    }
    return {
      shopId: popupShopId,
      codeId: els.txtCodeID ? els.txtCodeID.value : '',
      customerRef: els.txtCustomer ? els.txtCustomer.value.trim() : '',
      loanPackage: parseMoneyInput(els.txtTotalMoneyReceived ? els.txtTotalMoneyReceived.value : 0),
      revenue: parseMoneyInput(els.txtTotalMoney ? els.txtTotalMoney.value : 0),
      loanDays: Number(els.txtLoanTime ? els.txtLoanTime.value : 0),
      collectionIntervalDays: Number(els.txtFrequency ? els.txtFrequency.value : 1),
      loanDate: els.txtStrFromDate ? els.txtStrFromDate.value : '',
      note: els.txtNote ? els.txtNote.value.trim() : '',
      installerName: els.staffInput ? els.staffInput.value : '',
      paymentMethod: 'periodic',
      paymentDay: activeItem ? activeItem.paymentDay : '',
      statusCode: activeItem && activeItem.statusCode != null ? activeItem.statusCode : 0,
      statusText: activeItem && activeItem.statusText ? activeItem.statusText : 'Chậm trả góp',
      imei: activeItem ? activeItem.imei : '',
      mc: activeItem ? activeItem.mc : '',
      setupFee: activeItem ? activeItem.setupFee : 0,
      referralFee: activeItem ? activeItem.referralFee : 0,
      netDisbursement: activeItem ? activeItem.netDisbursement : parseMoneyInput(els.txtTotalMoneyReceived ? els.txtTotalMoneyReceived.value : 0),
      paidBefore: activeItem ? activeItem.paidBefore : 0
    };
  }

  var previewTimer = null;

  function queuePreview() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(function () {
      requestPreview().catch(function () {
        renderPreview(null);
      });
    }, 180);
  }

  async function requestPreview() {
    if (!config.previewUrl) return;
    var payload = buildMutationPayload();
    if (!payload.shopId || payload.shopId <= 0 || !payload.loanDate || payload.loanPackage <= 0 || payload.revenue <= 0 || payload.loanDays <= 0 || payload.collectionIntervalDays <= 0) {
      renderPreview(null);
      return;
    }
    if (validateMoneyRelation(payload)) {
      renderPreview(null);
      return;
    }
    if (!payload.customerRef && !payload.imei) payload.customerRef = 'Khach xem truoc';
    var result = await request(String(config.previewUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    renderPreview(result.summary || null);
  }

  async function openEditModal(id) {
    var payload = await request(String(config.detailUrlBase || '/installment/api') + '/' + encodeURIComponent(id), {
      headers: { Accept: 'application/json' }
    });
    populateForm(payload.item || null);
    showModal('#modal_create_pawn');
  }

  async function saveForm() {
    var payload = buildMutationPayload();
    if (!payload.shopId || payload.shopId <= 0) {
      notify('Thiếu dữ liệu', 'Cần chọn cửa hàng cho hợp đồng.');
      return;
    }
    if (!payload.customerRef) {
      notify('Thiếu dữ liệu', 'Tên khách hàng là bắt buộc.');
      return;
    }
    if (!payload.loanDate) {
      notify('Thiếu dữ liệu', 'Ngày bốc là bắt buộc.');
      return;
    }
    var moneyRelationError = validateMoneyRelation(payload);
    if (moneyRelationError) {
      notify('Dữ liệu không hợp lệ', moneyRelationError);
      return;
    }
    var id = Number(els.hfId ? els.hfId.value : 0);
    var url = id ? String(config.updateApiUrlBase || '/installment/api') + '/' + encodeURIComponent(id) : String(config.createApiUrl || '/installment/api');
    var method = id ? 'PUT' : 'POST';
    var result = await request(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    hideModal('#modal_create_pawn');
    await loadData();
    notify(id ? 'Cập nhật thành công' : 'Tạo thành công', result.Message || 'Đã lưu hợp đồng trả góp.');
  }

  function selectDropdownValue(type, value, label) {
    if (type === 'rate') {
      if (els.rateTypeInput) els.rateTypeInput.value = value;
      if (els.rateTypeSelected) els.rateTypeSelected.textContent = label;
      if (els.rateTypeDropdown) els.rateTypeDropdown.style.display = 'none';
      return;
    }
    if (els.staffInput) els.staffInput.value = value;
    if (els.staffSelected) els.staffSelected.textContent = label;
    if (els.staffDropdown) els.staffDropdown.style.display = 'none';
  }

  async function loadData() {
    readControls();
    els.tableBody.innerHTML = '<tr class="m-datatable__row"><td colspan="12" class="installment-annam-empty">Đang tải dữ liệu...</td></tr>';
    var params = new URLSearchParams();
    params.set('generalSearch', state.generalSearch);
    params.set('SearchShopId', state.shopId);
    params.set('StatusText', state.status);
    params.set('DueStatus', state.dueStatus);
    params.set('LoanTime', state.loanTime);
    params.set('FromDate', state.fromDate);
    params.set('ToDate', state.toDate);
    params.set('PageCurrent', String(state.page));
    params.set('PerPageCurrent', String(state.perPage));
    params.set('columnCurrent', state.sortColumn);
    params.set('sortCurrent', state.sortDirection);
    try {
      var payload = await request(String(config.listUrl || '/installment/api/list') + '?' + params.toString(), {
        headers: { Accept: 'application/json' }
      });
      state.items = Array.isArray(payload.items) ? payload.items : [];
      state.total = Number(payload.total || 0);
      state.totalPages = Math.max(1, Number(payload.totalPages || 1));
      state.statusSummary = Array.isArray(payload.statusSummary) ? payload.statusSummary : [];
      renderRows(state.items);
      renderPagination();
      updatePagerDetail();
      renderCards(payload.dashboard || state.bootstrap.dashboard || {});
      renderSummary(state.statusSummary);
    } catch (error) {
      els.tableBody.innerHTML = '<tr class="m-datatable__row"><td colspan="12" class="installment-annam-empty installment-annam-empty--error">Không tải được dữ liệu.</td></tr>';
      notify('Lỗi tải dữ liệu', error instanceof Error ? error.message : 'Không tải được dữ liệu trả góp.');
    }
  }

  async function exportVisibleRows() {
    if (!state.items.length) {
      notify('Không có dữ liệu', 'Danh sách hiện tại chưa có dòng nào để xuất.');
      return;
    }
    var headers = ['Mã HĐ', 'Khách hàng', 'Tiền giao khách', 'Nhân viên', 'Ngày vay', 'Ngày phải đóng', 'Tiền đã đóng', 'Tiền 1 kỳ', 'Còn phải đóng', 'Tình trạng'];
    var csv = [headers.join(',')].concat(state.items.map(function (item) {
      return [
        'HD-' + (item.stt || item.id),
        '"' + String(item.customerRef || '').replace(/"/g, '""') + '"',
        item.loanPackage || 0,
        '"' + String(item.installerName || '').replace(/"/g, '""') + '"',
        item.loanDate || '',
        item.paymentDay || '',
        item.paidBefore || 0,
        item.installmentAmount || 0,
        getRemainingMoney(item),
        '"' + String(item.statusText || '').replace(/"/g, '""') + '"'
      ].join(',');
    })).join('\r\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'installment-index-visible.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function persistScheduleProgress(nextPaidIndices) {
    if (!state.activeDetailItem) return;
    var payload = await request(String(config.progressUrlBase || '/installment/api/progress') + '/' + encodeURIComponent(state.activeDetailItem.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ paidPeriods: nextPaidIndices })
    });
    state.activeDetailItem = payload.item || payload.Data || payload.updated || payload;
    fillDetailModal(state.activeDetailItem);
    await loadData();
  }

  if (els.btnGetData) els.btnGetData.addEventListener('click', function () { state.page = 1; loadData(); });
  if (els.btnResetSearch) els.btnResetSearch.addEventListener('click', function () {
    if (els.generalSearch) els.generalSearch.value = '';
    if (els.statusFilter) els.statusFilter.value = '0';
    if (els.loanTimeFilter) els.loanTimeFilter.value = '0';
    if (els.fromDate) els.fromDate.value = '';
    if (els.toDate) els.toDate.value = '';
    if (els.shopFilter) els.shopFilter.value = String(config.defaultShopId || 0);
    state.dueStatus = String(config.defaultDueStatus || '');
    state.sortColumn = String(config.defaultSortColumn || 'loanDate');
    state.sortDirection = String(config.defaultSortDirection || 'desc') === 'asc' ? 'asc' : 'desc';
    state.page = 1;
    loadData();
  });
  if (els.btnViewAllShops && els.shopFilter) els.btnViewAllShops.addEventListener('click', function () { els.shopFilter.value = '0'; state.page = 1; loadData(); });
  if (els.btnExportVisible) els.btnExportVisible.addEventListener('click', exportVisibleRows);
  if (els.btnImportExcel) els.btnImportExcel.addEventListener('click', function () { if (els.excelFileInput) els.excelFileInput.click(); });
  if (els.btnModalCreate) els.btnModalCreate.addEventListener('click', function () { populateForm(null); showModal('#modal_create_pawn'); });
  if (els.btnTomorrowDueCheck) els.btnTomorrowDueCheck.addEventListener('click', function () { openTomorrowDueModal(); });
  if (els.btnTomorrowInstallmentsInline) els.btnTomorrowInstallmentsInline.addEventListener('click', function () { openTomorrowDueModal(); });
  if (els.btnSaveInstallment) els.btnSaveInstallment.addEventListener('click', function () { saveForm().catch(function (error) { notify('Không thể lưu', error instanceof Error ? error.message : 'Không thể lưu hợp đồng.'); }); });
  if (els.btnConfirmDeleteInstallment) els.btnConfirmDeleteInstallment.addEventListener('click', function () {
    if (!state.deleteId) return;
    request(String(config.deleteUrlBase || '/installment/api') + '/' + encodeURIComponent(state.deleteId), {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    }).then(function (payload) {
      hideModal('#modal_delete_installment');
      state.deleteId = null;
      return loadData().then(function () { notify('Xóa thành công', payload.Message || 'Đã xóa hợp đồng.'); });
    }).catch(function (error) {
      notify('Xóa thất bại', error instanceof Error ? error.message : 'Không thể xóa hợp đồng.');
    });
  });
  if (els.btnUpdateNextDate) els.btnUpdateNextDate.addEventListener('click', function () {
    if (!state.activeDetailItem || !els.nextDateInput || !els.nextDateInput.value) {
      notify('Thiếu dữ liệu', 'Cần chọn ngày đóng tiếp theo trước khi lưu.');
      return;
    }
    request(String(config.nextDateUrlBase || '/installment/api') + '/' + encodeURIComponent(state.activeDetailItem.id) + '/next-date', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ paymentDay: els.nextDateInput.value })
    }).then(function (payload) {
      hideModal('#modal_change_nextDate');
      state.activeDetailItem = payload.item || state.activeDetailItem;
      return loadData().then(function () { notify('Cập nhật thành công', payload.Message || 'Đã cập nhật ngày đóng tiếp theo.'); });
    }).catch(function (error) {
      notify('Cập nhật thất bại', error instanceof Error ? error.message : 'Không thể cập nhật ngày đóng tiếp theo.');
    });
  });
  if (els.btnDongHopDongVayHo) els.btnDongHopDongVayHo.addEventListener('click', function () {
    var fullPaid = state.activeDetailSchedule.map(function (row) { return row.periodIndex; });
    persistScheduleProgress(fullPaid).catch(function (error) {
      notify('Không thể đóng hợp đồng', error instanceof Error ? error.message : 'Không thể cập nhật tiến độ.');
    });
  });
  if (els.dashboardReloadLink) els.dashboardReloadLink.addEventListener('click', function (event) { event.preventDefault(); loadData(); });
  [els.statusFilter, els.loanTimeFilter, els.fromDate, els.toDate, els.shopFilter, els.perPageFilter].forEach(function (node) {
    if (!node) return;
    node.addEventListener('change', function () { state.page = 1; loadData(); });
  });
  [els.txtTotalMoney, els.txtLoanTime, els.txtFrequency].forEach(function (node) { if (node) node.addEventListener('input', updatePerCyclePreview); });
  [els.txtCustomer, els.txtTotalMoney, els.txtTotalMoneyReceived, els.txtLoanTime, els.txtFrequency, els.txtStrFromDate, els.popupShopId, els.txtNote].forEach(function (node) {
    if (!node) return;
    node.addEventListener('input', queuePreview);
    node.addEventListener('change', queuePreview);
  });
  if (els.generalSearch) {
    var searchTimer = null;
    els.generalSearch.addEventListener('input', function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () { state.page = 1; loadData(); }, 300);
    });
  }
  if (els.rateTypeDisplay) els.rateTypeDisplay.addEventListener('click', function () { if (els.rateTypeDropdown) els.rateTypeDropdown.style.display = els.rateTypeDropdown.style.display === 'block' ? 'none' : 'block'; });
  if (els.staffDisplay) els.staffDisplay.addEventListener('click', function () { if (els.staffDropdown) els.staffDropdown.style.display = els.staffDropdown.style.display === 'block' ? 'none' : 'block'; });

  Array.prototype.forEach.call(document.querySelectorAll('.installment-annam-table th[data-sort]'), function (header) {
    header.addEventListener('click', function () {
      var nextSort = header.getAttribute('data-sort');
      if (!nextSort) return;
      if (state.sortColumn === nextSort) state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      else {
        state.sortColumn = nextSort;
        state.sortDirection = nextSort === 'loanDate' ? 'desc' : 'asc';
      }
      state.page = 1;
      loadData();
    });
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) return;
    var pager = target.closest('.m-datatable__pager-link');
    if (pager && pager.getAttribute('data-page')) {
      event.preventDefault();
      if (pager.hasAttribute('disabled')) return;
      state.page = Number(pager.getAttribute('data-page') || state.page) || state.page;
      loadData();
      return;
    }
    var detailBtn = target.closest('.js-open-detail');
    if (detailBtn) {
      event.preventDefault();
      var detailId = Number(detailBtn.getAttribute('data-id') || 0);
      var detailItem = state.items.find(function (item) { return Number(item.id) === detailId; })
        || state.tomorrowDueItems.find(function (item) { return Number(item.id) === detailId; });
      if (detailItem) {
        fillDetailModal(detailItem);
        showModal('#modal_details_pawn');
        return;
      }
      request(String(config.detailUrlBase || '/installment/api') + '/' + encodeURIComponent(detailId), {
        headers: { Accept: 'application/json' }
      }).then(function (payload) {
        fillDetailModal(payload.item || null);
        showModal('#modal_details_pawn');
      }).catch(function (error) {
        notify('Không thể tải hợp đồng', error instanceof Error ? error.message : 'Không thể tải chi tiết hợp đồng.');
      });
      return;
    }
    var editBtn = target.closest('.js-open-edit');
    if (editBtn) {
      event.preventDefault();
      openEditModal(editBtn.getAttribute('data-id')).catch(function (error) {
        notify('Không thể tải hợp đồng', error instanceof Error ? error.message : 'Không thể tải hợp đồng cần sửa.');
      });
      return;
    }
    var deleteBtn = target.closest('.js-open-delete');
    if (deleteBtn) {
      event.preventDefault();
      state.deleteId = deleteBtn.getAttribute('data-id');
      var deleteItem = state.items.find(function (item) { return String(item.id) === String(state.deleteId); });
      if (els.deleteInstallmentMessage) els.deleteInstallmentMessage.textContent = deleteItem ? ('Bạn có chắc chắn muốn xóa hợp đồng ' + (deleteItem.customerRef || ('#' + deleteItem.id)) + '?') : 'Bạn có chắc chắn muốn xóa hợp đồng này?';
      showModal('#modal_delete_installment');
      return;
    }
    var nextDateBtn = target.closest('.js-open-next-date');
    if (nextDateBtn) {
      event.preventDefault();
      var nextDateId = Number(nextDateBtn.getAttribute('data-id') || 0);
      var nextDateItem = state.items.find(function (item) { return Number(item.id) === nextDateId; });
      if (nextDateItem && els.nextDateInput) {
        state.activeDetailItem = nextDateItem;
        els.nextDateInput.value = toDateValue(nextDateItem.paymentDay || '');
        renderNextDateHistoryRows(nextDateItem);
        showModal('#modal_change_nextDate');
      }
      return;
    }
    var option = target.closest('.custom-select-option');
    if (option) {
      selectDropdownValue(option.getAttribute('data-dropdown') === 'staff' ? 'staff' : 'rate', option.getAttribute('data-value') || '', option.textContent || '');
      queuePreview();
      return;
    }
    var payBtn = target.closest('.js-pay-schedule');
    if (payBtn && state.activeDetailSchedule.length) {
      event.preventDefault();
      var paidIndices = state.activeDetailSchedule.filter(function (row) { return row.paid; }).map(function (row) { return row.periodIndex; });
      paidIndices.push(Number(payBtn.getAttribute('data-period-index') || 0));
      paidIndices = paidIndices.filter(function (value, index, source) { return value > 0 && source.indexOf(value) === index; }).sort(function (a, b) { return a - b; });
      persistScheduleProgress(paidIndices).catch(function (error) {
        notify('Không thể cập nhật tiến độ', error instanceof Error ? error.message : 'Không thể cập nhật tiến độ đóng tiền.');
      });
      return;
    }
    var cancelBtn = target.closest('.js-cancel-schedule');
    if (cancelBtn && state.activeDetailSchedule.length) {
      event.preventDefault();
      var cancelIndex = Number(cancelBtn.getAttribute('data-period-index') || 0);
      var remainingIndices = state.activeDetailSchedule.filter(function (row) { return row.paid && row.periodIndex < cancelIndex; }).map(function (row) { return row.periodIndex; });
      persistScheduleProgress(remainingIndices).catch(function (error) {
        notify('Không thể hủy thanh toán', error instanceof Error ? error.message : 'Không thể hủy thanh toán kỳ này.');
      });
    }
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest('.custom-select-wrapper')) {
      if (els.rateTypeDropdown) els.rateTypeDropdown.style.display = 'none';
      if (els.staffDropdown) els.staffDropdown.style.display = 'none';
    }
  }, true);

  if (els.excelFileInput) {
    els.excelFileInput.addEventListener('change', function (event) {
      var target = event.target;
      if (!target.files || !target.files[0]) return;
      var shopId = state.shopId !== '0' ? state.shopId : String(config.contextShopId || config.defaultShopId || 0);
      if (!shopId || shopId === '0') {
        notify('Thiếu dữ liệu', 'Cần chọn cửa hàng trước khi import Excel.');
        target.value = '';
        return;
      }
      var formData = new FormData();
      formData.append('file', target.files[0]);
      formData.append('shopId', shopId);
      request(String(config.importUrl || '/installment/api/import'), {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' }
      }).then(function (payload) {
        target.value = '';
        return loadData().then(function () { notify('Import thành công', payload.Message || 'Đã nhập dữ liệu Excel.'); });
      }).catch(function (error) {
        target.value = '';
        notify('Import thất bại', error instanceof Error ? error.message : 'Không thể import Excel.');
      });
    });
  }

  bindMoneyInput(els.txtTotalMoney);
  bindMoneyInput(els.txtTotalMoneyReceived);
  setMoneyInputValue(els.txtTotalMoney, els.txtTotalMoney ? els.txtTotalMoney.value : 0);
  setMoneyInputValue(els.txtTotalMoneyReceived, els.txtTotalMoneyReceived ? els.txtTotalMoneyReceived.value : 0);
  renderInstallerOptions();
  updatePerCyclePreview();
  renderPreview(null);
  loadData();
})();
