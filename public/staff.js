(function () {
  var config = window.__STAFF_PAGE__ || {};
  var state = {
    generalSearch: "",
    status: "100",
    shopId: String(config.defaultShopId || 0),
    page: 1,
    perPage: 50,
    sortColumn: "createdDate",
    sortDirection: "desc",
    selectedIds: [],
    currentRowIds: [],
    currentItems: []
  };

  var elements = {
    generalSearch: document.getElementById("generalSearch"),
    statusFilter: document.getElementById("statusFilter"),
    shopFilter: document.getElementById("shopFilter"),
    perPageFilter: document.getElementById("perPageFilter"),
    reloadButton: document.getElementById("btnReloadData"),
    selectAll: document.getElementById("staffSelectAll"),
    selectedInfo: document.getElementById("staffSelectedInfo"),
    bulkDeleteButton: document.getElementById("btnStaffBulkDelete"),
    bulkStatusButton: document.getElementById("btnStaffBulkStatus"),
    exportButton: document.getElementById("btnStaffExport"),
    tableBody: document.getElementById("staffTableBody"),
    tableMeta: document.getElementById("staffTableMeta"),
    pagination: document.getElementById("staffPagination"),
    summaryCount: document.getElementById("staffSummaryCount"),
    summaryActive: document.getElementById("staffSummaryActive"),
    summaryInactive: document.getElementById("staffSummaryInactive")
  };

  var searchTimer = 0;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("vi-VN");
  }

  function buildDialogMessage(title, text) {
    return [title, text]
      .filter(function (value) {
        return String(value || "").trim().length > 0;
      })
      .join("\n");
  }

  function getDialogApi() {
    if (window.AppDialog && typeof window.AppDialog.alert === "function") {
      return window.AppDialog;
    }
    return null;
  }

  function notify(title, text, type) {
    var dialog = getDialogApi();
    if (dialog) {
      dialog.alert({
        title: title,
        text: text,
        type: type || "info",
        confirmText: "Dong"
      });
      return;
    }
    window.alert(buildDialogMessage(title, text));
  }

  async function askConfirm(title, text, type) {
    var dialog = getDialogApi();
    if (dialog) {
      return dialog.confirm({
        title: title,
        text: text,
        type: type || "warning",
        confirmText: "Xac nhan",
        cancelText: "Huy"
      });
    }
    return window.confirm(buildDialogMessage(title, text));
  }

  async function promptTransferStaffId(options) {
    if (!Array.isArray(options) || options.length === 0) {
      return null;
    }

    var dialog = getDialogApi();
    if (dialog) {
      var selectedValue = await dialog.select({
        title: "Chon nhan vien nhan du lieu",
        text: "Du lieu lien quan se chuyen sang nhan vien duoc chon.",
        label: "Nhân viên nhận dữ liệu",
        placeholder: "Chon nhan vien nhan du lieu",
        options: options.map(function (item) {
          var display = item.fullName ? item.fullName + " (" + item.username + ")" : item.username;
          return {
            value: String(item.id),
            label: String(item.id) + " - " + String(display || "")
          };
        }),
        required: true,
        requiredMessage: "Vui lòng chọn nhân viên nhận dữ liệu trước khi xóa.",
        confirmText: "Chon",
        cancelText: "Huy",
        type: "warning"
      });
      return selectedValue == null ? null : String(selectedValue).trim();
    }

    var optionsText = options
      .map(function (item) {
        var display = item.fullName ? item.fullName + " (" + item.username + ")" : item.username;
        return String(item.id) + " - " + String(display || "");
      })
      .join("\n");

    while (true) {
      var input = window.prompt(
        "Chon nhan vien nhan du lieu truoc khi xoa.\nNhap ID nhan vien theo danh sach:\n" + optionsText,
        ""
      );
      if (input === null) {
        return null;
      }

      var transferStaffId = String(input || "").trim();
      if (!transferStaffId) {
        notify("Chưa chọn nhân viên", "Vui lòng chọn nhân viên nhận dữ liệu trước khi xóa.");
        continue;
      }

      var matchedOption = options.find(function (item) {
        return String(item.id) === transferStaffId;
      });
      if (!matchedOption) {
        notify("ID không hợp lệ", "Không tìm thấy nhân viên nhận dữ liệu với ID vừa nhập.");
        continue;
      }

      return transferStaffId;
    }
  }

  async function promptStaffStatus() {
    var dialog = getDialogApi();
    if (dialog) {
      var selectedStatus = await dialog.select({
        title: "Đổi trạng thái nhiều nhân viên",
        text: "Chon trang thai can cap nhat cho danh sach da chon.",
        label: "Trang thai",
        placeholder: "Chon trang thai",
        options: [
          { value: "1", label: "Đang làm việc" },
          { value: "0", label: "Tạm khóa" }
        ],
        required: true,
        requiredMessage: "Vui lòng chọn trạng thái cần cập nhật.",
        confirmText: "Cập nhật",
        cancelText: "Huy",
        type: "info"
      });
      return selectedStatus == null ? null : String(selectedStatus).trim();
    }

    while (true) {
      var value = window.prompt(
        "Đổi trạng thái nhiều nhân viên\nNhập 1 để Đang làm việc hoặc 0 để Tạm khóa.",
        ""
      );
      if (value === null) {
        return null;
      }

      var normalized = String(value).trim();
      if (normalized === "1" || normalized === "0") {
        return normalized;
      }

      notify("Dữ liệu chưa hợp lệ", "Vui lòng nhập 1 (Đang làm việc) hoặc 0 (Tạm khóa).");
    }
  }

  function csvEscape(value) {
    var text = String(value == null ? "" : value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function downloadCsv(filename, headers, rows) {
    var lines = [headers.map(csvEscape).join(",")]
      .concat(
        rows.map(function (row) {
          return row.map(csvEscape).join(",");
        })
      )
      .join("\r\n");
    var blob = new Blob(["\ufeff" + lines], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function readJsonResponse(response) {
    return response.text().then(function (text) {
      try {
        return JSON.parse(text);
      } catch (error) {
        if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
          throw new Error("API dang tra ve HTML thay vi JSON. Kiem tra session hoac route backend.");
        }
        throw new Error("API nhan vien dang tra ve du lieu khong hop le.");
      }
    });
  }

  function updateSortHeaders() {
    document.querySelectorAll(".staff-table thead th[data-sort]").forEach(function (th) {
      if (!th.dataset.baseLabel) {
        th.dataset.baseLabel = th.textContent || "";
      }

      var isActive = th.dataset.sort === state.sortColumn;
      th.classList.toggle("is-active", isActive);
      th.textContent = !isActive ? th.dataset.baseLabel : th.dataset.baseLabel + (state.sortDirection === "asc" ? " ^" : " v");
    });
  }

  function getSelectedItems() {
    return state.currentItems.filter(function (item) {
      return state.selectedIds.indexOf(String(item.id)) >= 0;
    });
  }

  function updateSelectionUi() {
    var selectedCount = state.selectedIds.length;
    var hasSelection = selectedCount > 0;

    if (elements.selectedInfo) {
      elements.selectedInfo.textContent = "Da chon " + formatNumber(selectedCount) + " dong";
    }

    if (elements.selectAll) {
      elements.selectAll.checked = state.currentRowIds.length > 0 && selectedCount === state.currentRowIds.length;
      elements.selectAll.indeterminate = selectedCount > 0 && selectedCount < state.currentRowIds.length;
    }

    if (elements.bulkDeleteButton) {
      elements.bulkDeleteButton.disabled = !config.canDeleteStaff;
    }

    if (elements.bulkStatusButton) {
      elements.bulkStatusButton.disabled = !hasSelection;
    }

    if (elements.exportButton) {
      elements.exportButton.disabled = !hasSelection;
    }
  }

  function resetSelection(items) {
    state.selectedIds = [];
    state.currentItems = items.slice();
    state.currentRowIds = items.map(function (item) {
      return String(item.id);
    });
    updateSelectionUi();
  }

  function buildQuery() {
    var params = new URLSearchParams();
    params.set("generalSearch", state.generalSearch);
    params.set("Status", state.status);
    params.set("SearchShopId", state.shopId);
    params.set("PageCurrent", String(state.page));
    params.set("PerPageCurrent", String(state.perPage));
    params.set("columnCurrent", state.sortColumn);
    params.set("sortCurrent", state.sortDirection);
    return params;
  }

  function syncState() {
    state.generalSearch = elements.generalSearch.value.trim();
    state.status = elements.statusFilter.value;
    state.shopId = elements.shopFilter ? elements.shopFilter.value : "0";
    state.perPage = Number(elements.perPageFilter.value || 50);
  }

  function statusBadge(item) {
    return item.status === 1
      ? '<span class="m-badge m-badge--success m-badge--wide">Đang làm việc</span>'
      : '<span class="m-badge m-badge--danger m-badge--wide">Tạm khóa</span>';
  }

  function rowActions(item) {
    var permissionButton = config.canManagePermissions
      ? '<a class="btn btn-sm btn-brand" href="/Staff/PermissionStaff/?StaffID=' +
        encodeURIComponent(item.id) +
        '">Quyen</a>'
      : "";
    var deleteButton = config.canDeleteStaff
      ? '<button class="btn btn-sm btn-danger js-delete-staff" type="button" data-id="' +
        escapeHtml(item.id) +
        '" data-name="' +
        escapeHtml(item.fullName) +
        '">Xoa</button>'
      : "";

    return (
      '<div class="staff-actions">' +
      '<a class="btn btn-sm btn-secondary" href="/Staff/Create?StaffID=' +
      encodeURIComponent(item.id) +
      '">Sua</a>' +
      permissionButton +
      deleteButton +
      "</div>"
    );
  }

  function renderRows(items) {
    if (!items.length) {
      elements.tableBody.innerHTML =
        '<tr><td colspan="10" class="text-center text-muted">Chưa có dữ liệu nhân viên.</td></tr>';
      return;
    }

    elements.tableBody.innerHTML = items
      .map(function (item) {
        var rowId = String(item.id);
        return (
          '<tr data-row-id="' +
          escapeHtml(rowId) +
          '">' +
          '<td class="app-table__select-cell"><input class="app-table__checkbox js-staff-select-row" type="checkbox" data-id="' +
          escapeHtml(rowId) +
          '"' +
          (state.selectedIds.indexOf(rowId) >= 0 ? " checked" : "") +
          "></td>" +
          "<td>" +
          escapeHtml(item.shopName || "") +
          "</td>" +
          "<td>" +
          escapeHtml(item.username) +
          "</td>" +
          "<td>" +
          escapeHtml(item.fullName) +
          "</td>" +
          "<td>" +
          escapeHtml(item.email || "") +
          "</td>" +
          "<td>" +
          escapeHtml(item.phone || "") +
          "</td>" +
          "<td>" +
          escapeHtml(item.role === "admin" ? "Admin" : "Nhân viên") +
          "</td>" +
          '<td class="text-center">' +
          escapeHtml(item.createdDateDisplay || "") +
          "</td>" +
          '<td class="text-center">' +
          statusBadge(item) +
          "</td>" +
          "<td>" +
          rowActions(item) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderSummary(summary) {
    elements.summaryCount.textContent = formatNumber(summary.count);
    elements.summaryActive.textContent = formatNumber(summary.activeCount);
    elements.summaryInactive.textContent = formatNumber(summary.inactiveCount);
  }

  function createPageButton(label, page, disabled, active) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-sm " + (active ? "btn-brand" : "btn-secondary");
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", function () {
      if (!disabled && page !== state.page) {
        state.page = page;
        loadData();
      }
    });
    return button;
  }

  function renderPagination(totalPages) {
    elements.pagination.innerHTML = "";
    if (totalPages <= 1) {
      return;
    }

    elements.pagination.appendChild(createPageButton("<", Math.max(1, state.page - 1), state.page === 1, false));
    var start = Math.max(1, state.page - 2);
    var end = Math.min(totalPages, state.page + 2);
    for (var page = start; page <= end; page += 1) {
      elements.pagination.appendChild(createPageButton(String(page), page, false, page === state.page));
    }
    elements.pagination.appendChild(
      createPageButton(">", Math.min(totalPages, state.page + 1), state.page === totalPages, false)
    );
  }

  function requireSelection(entityLabel) {
    if (state.selectedIds.length > 0) {
      return true;
    }

    notify("Chưa chọn dữ liệu", "Vui lòng chọn ít nhất một " + entityLabel + " để thao tác.");
    return false;
  }

  async function loadTransferStaffOptions(excludeIds) {
    if (!config.transferOptionsUrl) {
      return [];
    }

    var params = new URLSearchParams();
    if (Array.isArray(excludeIds) && excludeIds.length > 0) {
      params.set("excludeIds", excludeIds.join(","));
    }

    var response = await fetch(
      config.transferOptionsUrl + (params.toString() ? "?" + params.toString() : ""),
      { headers: { Accept: "application/json" } }
    );
    var payload = await readJsonResponse(response);
    if (!response.ok || payload.Result !== 1) {
      throw new Error(payload.Message || "Không thể tải danh sách nhân viên nhận dữ liệu.");
    }
    return Array.isArray(payload.items) ? payload.items : [];
  }

  async function loadData() {
    syncState();
    updateSortHeaders();
    elements.tableBody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">Đang tải dữ liệu...</td></tr>';

    try {
      var response = await fetch(config.listUrl + "?" + buildQuery().toString(), {
        headers: { Accept: "application/json" }
      });
      var payload = await readJsonResponse(response);
      if (!response.ok || payload.Result !== 1) {
        throw new Error(payload.Message || "Không thể tải dữ liệu nhân viên.");
      }

      resetSelection(payload.items);
      renderRows(payload.items);
      renderSummary(payload.summary);
      elements.tableMeta.textContent =
        "Hien thi " +
        formatNumber(payload.items.length) +
        " / " +
        formatNumber(payload.total) +
        " dong, trang " +
        formatNumber(payload.page) +
        " / " +
        formatNumber(payload.totalPages);
      renderPagination(payload.totalPages);
      updateSortHeaders();
    } catch (error) {
      elements.tableBody.innerHTML =
        '<tr><td colspan="10" class="text-center text-danger">Không thể tải dữ liệu. Vui lòng thử lại.</td></tr>';
      notify("Lỗi tải dữ liệu", error instanceof Error ? error.message : "Không thể tải danh sách nhân viên.");
    }
  }

  async function deleteRow(id, name) {
    var transferOptions = [];
    try {
      transferOptions = await loadTransferStaffOptions([id]);
    } catch (error) {
      notify(
        "Không thể tải dữ liệu chuyển",
        error instanceof Error ? error.message : "Không thể tải danh sách nhân viên nhận dữ liệu."
      );
      return;
    }
    if (transferOptions.length === 0) {
      notify(
        "Không thể xóa",
        "Không có nhân viên nhận dữ liệu. Vui lòng tạo hoặc kích hoạt ít nhất một nhân viên khác trước khi xóa."
      );
      return;
    }
    var transferStaffId = await promptTransferStaffId(transferOptions);
    if (!transferStaffId) {
      return;
    }
    if (
      !(await askConfirm(
        "Xoa nhan vien",
        'Ban muon xoa nhan vien "' +
          String(name || "nhan vien") +
          '"?\nDu lieu lien quan se duoc chuyen sang nhan vien ID: ' +
          transferStaffId +
          "."
      ))
    ) {
      return;
    }

    try {
      var response = await fetch(config.deleteUrlBase + "/" + encodeURIComponent(id), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          transferStaffId: transferStaffId
        })
      });
      var payload = await readJsonResponse(response);
      if (!response.ok || payload.Result !== 1) {
        throw new Error(payload.Message || "Không thể xóa nhân viên.");
      }

      notify("Da xoa", payload.Message || "Da xoa nhan vien thanh cong.");
      await loadData();
    } catch (error) {
      notify("Không thể xóa", error instanceof Error ? error.message : "Không thể xóa nhân viên.");
    }
  }

  async function bulkDeleteRows() {
    if (!requireSelection("nhan vien")) {
      return;
    }

    var transferOptions = [];
    try {
      transferOptions = await loadTransferStaffOptions(state.selectedIds);
    } catch (error) {
      notify(
        "Không thể tải dữ liệu chuyển",
        error instanceof Error ? error.message : "Không thể tải danh sách nhân viên nhận dữ liệu."
      );
      return;
    }
    if (transferOptions.length === 0) {
      notify(
        "Không thể xóa",
        "Không có nhân viên nhận dữ liệu. Vui lòng tạo hoặc kích hoạt ít nhất một nhân viên khác trước khi xóa."
      );
      return;
    }
    var transferStaffId = await promptTransferStaffId(transferOptions);
    if (!transferStaffId) {
      return;
    }
    if (
      !(await askConfirm(
        "Xoa nhieu nhan vien",
        "Ban muon xoa " +
          formatNumber(state.selectedIds.length) +
          " nhan vien da chon?\nDu lieu lien quan se duoc chuyen sang nhan vien ID: " +
          transferStaffId +
          "."
      ))
    ) {
      return;
    }

    try {
      var response = await fetch(config.bulkDeleteUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          ids: state.selectedIds,
          transferStaffId: transferStaffId
        })
      });
      var payload = await readJsonResponse(response);
      if (!response.ok || payload.Result !== 1) {
        throw new Error(payload.Message || "Không thể xóa nhiều nhân viên.");
      }

      notify("Da xoa", payload.Message || "Da xoa nhieu nhan vien thanh cong.");

      await loadData();
    } catch (error) {
      notify("Không thể xóa", error instanceof Error ? error.message : "Không thể xóa nhiều nhân viên.");
    }
  }

  async function bulkUpdateStatus() {
    if (!requireSelection("nhan vien")) {
      return;
    }

    var statusValue = await promptStaffStatus();
    if (statusValue === null) {
      return;
    }

    try {
      var response = await fetch(config.bulkStatusUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          ids: state.selectedIds,
          status: statusValue
        })
      });
      var payload = await readJsonResponse(response);
      if (!response.ok || payload.Result !== 1) {
        throw new Error(payload.Message || "Không thể đổi trạng thái nhiều nhân viên.");
      }

      notify("Cập nhật thành công", payload.Message || "Đã cập nhật trạng thái nhân viên.");

      await loadData();
    } catch (error) {
      notify(
        "Không thể cập nhật",
        error instanceof Error ? error.message : "Không thể đổi trạng thái nhiều nhân viên."
      );
    }
  }

  function exportSelectedRows() {
    if (!requireSelection("nhan vien")) {
      return;
    }

    var items = getSelectedItems();
    downloadCsv(
      "staff-selected.csv",
      ["Cửa hàng", "Tài khoản", "Họ tên", "Email", "Điện thoại", "Role", "Ngày tạo", "Tình trạng"],
      items.map(function (item) {
        return [
          item.shopName,
          item.username,
          item.fullName,
          item.email,
          item.phone,
          item.role === "admin" ? "Admin" : "Nhân viên",
          item.createdDateDisplay,
          item.statusText
        ];
      })
    );
  }

  elements.reloadButton.addEventListener("click", function () {
    state.page = 1;
    loadData();
  });

  if (elements.bulkDeleteButton) {
    elements.bulkDeleteButton.addEventListener("click", bulkDeleteRows);
  }

  if (elements.bulkStatusButton) {
    elements.bulkStatusButton.addEventListener("click", bulkUpdateStatus);
  }

  if (elements.exportButton) {
    elements.exportButton.addEventListener("click", exportSelectedRows);
  }

  [elements.statusFilter, elements.perPageFilter].forEach(function (element) {
    element.addEventListener("change", function () {
      state.page = 1;
      loadData();
    });
  });

  if (elements.shopFilter) {
    elements.shopFilter.value = state.shopId;
    elements.shopFilter.addEventListener("change", function () {
      state.page = 1;
      loadData();
    });
  }

  elements.generalSearch.addEventListener("input", function () {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      state.page = 1;
      loadData();
    }, 450);
  });

  if (elements.selectAll) {
    elements.selectAll.addEventListener("change", function () {
      state.selectedIds = elements.selectAll.checked ? state.currentRowIds.slice() : [];
      document.querySelectorAll(".js-staff-select-row").forEach(function (checkbox) {
        checkbox.checked = state.selectedIds.indexOf(checkbox.getAttribute("data-id") || "") >= 0;
        var row = checkbox.closest("tr");
        if (row) {
          row.classList.toggle("is-selected", checkbox.checked);
        }
      });
      updateSelectionUi();
    });
  }

  document.querySelectorAll(".staff-table thead th[data-sort]").forEach(function (th) {
    th.addEventListener("click", function () {
      var nextSortColumn = th.dataset.sort;
      if (!nextSortColumn) {
        return;
      }

      if (state.sortColumn === nextSortColumn) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortColumn = nextSortColumn;
        state.sortDirection = nextSortColumn === "createdDate" ? "desc" : "asc";
      }

      state.page = 1;
      loadData();
    });
  });

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    var deleteButton = target.closest(".js-delete-staff");
    if (!deleteButton) {
      return;
    }

    event.preventDefault();
    deleteRow(deleteButton.dataset.id, deleteButton.dataset.name || "nhan vien");
  });

  document.addEventListener("change", function (event) {
    var target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains("js-staff-select-row")) {
      return;
    }

    var rowId = target.getAttribute("data-id") || "";
    state.selectedIds = Array.from(
      new Set(
        target.checked
          ? state.selectedIds.concat(rowId)
          : state.selectedIds.filter(function (id) {
              return id !== rowId;
            })
      )
    );

    var row = target.closest("tr");
    if (row) {
      row.classList.toggle("is-selected", target.checked);
    }

    updateSelectionUi();
  });

  updateSortHeaders();
  updateSelectionUi();
  loadData();
})();
