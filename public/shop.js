(function () {
  var config = window.__SHOP_PAGE__ || {};
  var state = {
    generalSearch: "",
    status: "100",
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
    perPageFilter: document.getElementById("perPageFilter"),
    reloadButton: document.getElementById("btnReloadData"),
    selectAll: document.getElementById("shopSelectAll"),
    selectedInfo: document.getElementById("shopSelectedInfo"),
    bulkDeleteButton: document.getElementById("btnShopBulkDelete"),
    bulkStatusButton: document.getElementById("btnShopBulkStatus"),
    exportButton: document.getElementById("btnShopExport"),
    tableBody: document.getElementById("shopTableBody"),
    tableMeta: document.getElementById("shopTableMeta"),
    pagination: document.getElementById("shopPagination"),
    dashboardTotal: document.getElementById("shopDashboardTotal"),
    dashboardActive: document.getElementById("shopDashboardActive"),
    dashboardInactive: document.getElementById("shopDashboardInactive"),
    dashboardMoney: document.getElementById("shopDashboardMoney"),
    dashboardAverage: document.getElementById("shopDashboardAverage")
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

  function formatCurrency(value) {
    return formatNumber(value) + " ₫";
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

  async function promptTransferShopId(options) {
    if (!Array.isArray(options) || options.length === 0) {
      return null;
    }

    var dialog = getDialogApi();
    if (dialog) {
      var selectedValue = await dialog.select({
        title: "Chon cua hang nhan du lieu",
        text: "Du lieu lien quan se chuyen sang cua hang duoc chon.",
        label: "Cửa hàng nhận dữ liệu",
        placeholder: "Chon cua hang nhan du lieu",
        options: options.map(function (item) {
          return {
            value: String(item.id),
            label: String(item.id) + " - " + String(item.name || "")
          };
        }),
        required: true,
        requiredMessage: "Vui lòng chọn cửa hàng nhận dữ liệu trước khi xóa.",
        confirmText: "Chon",
        cancelText: "Huy",
        type: "warning"
      });
      return selectedValue == null ? null : String(selectedValue).trim();
    }

    var optionsText = options
      .map(function (item) {
        return String(item.id) + " - " + String(item.name || "");
      })
      .join("\n");

    while (true) {
      var input = window.prompt(
        "Chon cua hang nhan du lieu truoc khi xoa.\nNhap ID cua hang theo danh sach:\n" + optionsText,
        ""
      );
      if (input === null) {
        return null;
      }

      var transferShopId = String(input || "").trim();
      if (!transferShopId) {
        notify("Chưa chọn cửa hàng", "Vui lòng chọn cửa hàng nhận dữ liệu trước khi xóa.");
        continue;
      }

      var matchedOption = options.find(function (item) {
        return String(item.id) === transferShopId;
      });
      if (!matchedOption) {
        notify("ID không hợp lệ", "Không tìm thấy cửa hàng nhận dữ liệu với ID vừa nhập.");
        continue;
      }

      return transferShopId;
    }
  }

  async function promptShopStatus() {
    var dialog = getDialogApi();
    if (dialog) {
      var selectedStatus = await dialog.select({
        title: "Đổi trạng thái nhiều cửa hàng",
        text: "Chon trang thai can cap nhat cho danh sach da chon.",
        label: "Trang thai",
        placeholder: "Chon trang thai",
        options: [
          { value: "1", label: "Đang hoạt động" },
          { value: "0", label: "Da tam dung" }
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
        "Đổi trạng thái nhiều cửa hàng\nNhập 1 để Đang hoạt động hoặc 0 để Đã tạm dừng.",
        ""
      );
      if (value === null) {
        return null;
      }

      var normalized = String(value).trim();
      if (normalized === "1" || normalized === "0") {
        return normalized;
      }

      notify("Dữ liệu chưa hợp lệ", "Vui lòng nhập 1 (Đang hoạt động) hoặc 0 (Đã tạm dừng).");
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

  async function readJsonResponse(response) {
    var text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        throw new Error("API dang tra ve HTML thay vi JSON. Kiem tra session hoac route backend.");
      }
      throw error;
    }
  }

  function updateSortHeaders() {
    document.querySelectorAll(".shop-table thead th[data-sort]").forEach(function (th) {
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
      elements.bulkDeleteButton.disabled = !config.canDeleteShop;
    }

    if (elements.bulkStatusButton) {
      elements.bulkStatusButton.disabled = !hasSelection || !config.canBulkUpdateShopStatus;
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
    params.set("PageCurrent", String(state.page));
    params.set("PerPageCurrent", String(state.perPage));
    params.set("columnCurrent", state.sortColumn);
    params.set("sortCurrent", state.sortDirection);
    return params;
  }

  function syncState() {
    state.generalSearch = elements.generalSearch.value.trim();
    state.status = elements.statusFilter.value;
    state.perPage = Number(elements.perPageFilter.value || 50);
  }

  function renderDashboard(dashboard) {
    elements.dashboardTotal.textContent = formatNumber(dashboard.totalShops);
    elements.dashboardActive.textContent = formatNumber(dashboard.activeShops);
    elements.dashboardInactive.textContent = formatNumber(dashboard.inactiveShops);
    elements.dashboardMoney.textContent = formatCurrency(dashboard.totalMoney);
    elements.dashboardAverage.textContent = formatCurrency(Math.round(dashboard.averageMoney || 0));
  }

  function statusBadge(item) {
    return item.status === 1
      ? '<span class="m-badge m-badge--success m-badge--wide">Đang hoạt động</span>'
      : '<span class="m-badge m-badge--danger m-badge--wide">Da tam dung</span>';
  }

  function rowActions(item) {
    var deleteButton = config.canDeleteShop
      ? '<button class="btn btn-sm btn-danger js-delete-shop" type="button" data-id="' +
        escapeHtml(item.id) +
        '" data-name="' +
        escapeHtml(item.name) +
        '">Xoa</button>'
      : "";

    return (
      '<div class="shop-actions">' +
      '<a class="btn btn-sm btn-secondary" href="/Shop/Create?ShopID=' +
      encodeURIComponent(item.id) +
      '">Sua</a>' +
      deleteButton +
      "</div>"
    );
  }

  function renderRows(items) {
    if (!items.length) {
      elements.tableBody.innerHTML =
        '<tr><td colspan="9" class="text-center text-muted">Chưa có dữ liệu cửa hàng.</td></tr>';
      return;
    }

    elements.tableBody.innerHTML = items
      .map(function (item) {
        var rowId = String(item.id);
        return (
          '<tr data-row-id="' +
          escapeHtml(rowId) +
          '">' +
          '<td class="app-table__select-cell"><input class="app-table__checkbox js-shop-select-row" type="checkbox" data-id="' +
          escapeHtml(rowId) +
          '"' +
          (state.selectedIds.indexOf(rowId) >= 0 ? " checked" : "") +
          "></td>" +
          '<td><a href="/Shop/Create?ShopID=' +
          encodeURIComponent(item.id) +
          '" class="font-weight-bold">' +
          escapeHtml(item.name) +
          "</a></td>" +
          "<td>" +
          escapeHtml(item.address) +
          "</td>" +
          "<td>" +
          escapeHtml(item.phone) +
          "</td>" +
          "<td>" +
          escapeHtml(item.represent) +
          "</td>" +
          '<td class="text-right">' +
          formatCurrency(item.totalMoney) +
          "</td>" +
          '<td class="text-center">' +
          escapeHtml(item.createdDateDisplay) +
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

  async function loadTransferShopOptions(excludeIds) {
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
      throw new Error(payload.Message || "Không thể tải danh sách cửa hàng nhận dữ liệu.");
    }
    return Array.isArray(payload.items) ? payload.items : [];
  }

  async function loadData() {
    syncState();
    updateSortHeaders();
    elements.tableBody.innerHTML =
      '<tr><td colspan="9" class="text-center text-muted">Đang tải dữ liệu...</td></tr>';

    try {
      var response = await fetch(config.listUrl + "?" + buildQuery().toString(), {
        headers: { Accept: "application/json" }
      });
      var payload = await readJsonResponse(response);

      if (!response.ok || payload.Result !== 1) {
        throw new Error(payload.Message || "Không thể tải dữ liệu cửa hàng.");
      }

      resetSelection(payload.items);
      renderRows(payload.items);
      renderDashboard(payload.dashboard);
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
        '<tr><td colspan="9" class="text-center text-danger">Không thể tải dữ liệu. Vui lòng thử lại.</td></tr>';
      notify("Lỗi tải dữ liệu", error instanceof Error ? error.message : "Không thể tải dữ liệu cửa hàng.");
    }
  }

  async function deleteRow(id, name) {
    var transferOptions = [];
    try {
      transferOptions = await loadTransferShopOptions([id]);
    } catch (error) {
      notify(
        "Không thể tải dữ liệu chuyển",
        error instanceof Error ? error.message : "Không thể tải danh sách cửa hàng nhận dữ liệu."
      );
      return;
    }
    if (transferOptions.length === 0) {
      notify(
        "Không thể xóa",
        "Không có cửa hàng nhận dữ liệu. Vui lòng tạo hoặc kích hoạt ít nhất một cửa hàng khác trước khi xóa."
      );
      return;
    }
    var transferShopId = await promptTransferShopId(transferOptions);
    if (!transferShopId) {
      return;
    }
    if (
      !(await askConfirm(
        "Xoa cua hang",
        'Ban muon xoa cua hang "' +
          String(name || "cua hang") +
          '"?\nDu lieu lien quan se duoc chuyen sang cua hang ID: ' +
          transferShopId +
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
          transferShopId: transferShopId
        })
      });
      var payload = await readJsonResponse(response);
      if (!response.ok || payload.Result !== 1) {
        throw new Error(payload.Message || "Không thể xóa cửa hàng.");
      }

      notify("Da xoa", payload.Message || "Da xoa cua hang thanh cong.");

      await loadData();
    } catch (error) {
      notify("Không thể xóa", error instanceof Error ? error.message : "Không thể xóa cửa hàng.");
    }
  }

  async function bulkDeleteRows() {
    if (!requireSelection("cua hang")) {
      return;
    }

    var transferOptions = [];
    try {
      transferOptions = await loadTransferShopOptions(state.selectedIds);
    } catch (error) {
      notify(
        "Không thể tải dữ liệu chuyển",
        error instanceof Error ? error.message : "Không thể tải danh sách cửa hàng nhận dữ liệu."
      );
      return;
    }
    if (transferOptions.length === 0) {
      notify(
        "Không thể xóa",
        "Không có cửa hàng nhận dữ liệu. Vui lòng tạo hoặc kích hoạt ít nhất một cửa hàng khác trước khi xóa."
      );
      return;
    }
    var transferShopId = await promptTransferShopId(transferOptions);
    if (!transferShopId) {
      return;
    }
    if (
      !(await askConfirm(
        "Xoa nhieu cua hang",
        "Ban muon xoa " +
          formatNumber(state.selectedIds.length) +
          " cua hang da chon?\nDu lieu lien quan se duoc chuyen sang cua hang ID: " +
          transferShopId +
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
          transferShopId: transferShopId
        })
      });
      var payload = await readJsonResponse(response);
      if (!response.ok || payload.Result !== 1) {
        throw new Error(payload.Message || "Không thể xóa nhiều cửa hàng.");
      }

      notify("Da xoa", payload.Message || "Da xoa nhieu cua hang thanh cong.");

      await loadData();
    } catch (error) {
      notify("Không thể xóa", error instanceof Error ? error.message : "Không thể xóa nhiều cửa hàng.");
    }
  }

  async function bulkUpdateStatus() {
    if (!requireSelection("cua hang")) {
      return;
    }

    var statusValue = await promptShopStatus();
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
        throw new Error(payload.Message || "Không thể đổi trạng thái nhiều cửa hàng.");
      }

      notify("Cập nhật thành công", payload.Message || "Đã cập nhật trạng thái cửa hàng.");

      await loadData();
    } catch (error) {
      notify("Không thể cập nhật", error instanceof Error ? error.message : "Không thể đổi trạng thái nhiều cửa hàng.");
    }
  }

  function exportSelectedRows() {
    if (!requireSelection("cua hang")) {
      return;
    }

    var items = getSelectedItems();
    downloadCsv(
      "shops-selected.csv",
      ["Cửa hàng", "Địa chỉ", "Điện thoại", "Đại diện", "Vốn đầu tư", "Ngày tạo", "Tình trạng"],
      items.map(function (item) {
        return [
          item.name,
          item.address,
          item.phone,
          item.represent,
          formatCurrency(item.totalMoney),
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

  elements.statusFilter.addEventListener("change", function () {
    state.page = 1;
    loadData();
  });

  elements.perPageFilter.addEventListener("change", function () {
    state.page = 1;
    loadData();
  });

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
      document.querySelectorAll(".js-shop-select-row").forEach(function (checkbox) {
        checkbox.checked = state.selectedIds.indexOf(checkbox.getAttribute("data-id") || "") >= 0;
        var row = checkbox.closest("tr");
        if (row) {
          row.classList.toggle("is-selected", checkbox.checked);
        }
      });
      updateSelectionUi();
    });
  }

  document.querySelectorAll(".shop-table thead th[data-sort]").forEach(function (th) {
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

    var deleteButton = target.closest(".js-delete-shop");
    if (!deleteButton) {
      return;
    }

    event.preventDefault();
    deleteRow(deleteButton.dataset.id, deleteButton.dataset.name || "cua hang");
  });

  document.addEventListener("change", function (event) {
    var target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains("js-shop-select-row")) {
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
