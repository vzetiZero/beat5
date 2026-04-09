(function () {
  var config = window.__TRASH_PAGE__ || {};
  var state = {
    generalSearch: "",
    entityType: "",
    includeRestored: false,
    page: 1,
    perPage: 50
  };

  var elements = {
    generalSearch: document.getElementById("generalSearch"),
    entityTypeFilter: document.getElementById("entityTypeFilter"),
    includeRestored: document.getElementById("includeRestored"),
    perPageFilter: document.getElementById("perPageFilter"),
    reloadButton: document.getElementById("btnReloadTrash"),
    tableBody: document.getElementById("trashTableBody"),
    tableMeta: document.getElementById("trashTableMeta"),
    pagination: document.getElementById("trashPagination")
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

  function syncState() {
    state.generalSearch = elements.generalSearch.value.trim();
    state.entityType = elements.entityTypeFilter.value;
    state.includeRestored = Boolean(elements.includeRestored.checked);
    state.perPage = Number(elements.perPageFilter.value || 50);
  }

  function buildQuery() {
    var params = new URLSearchParams();
    params.set("generalSearch", state.generalSearch);
    params.set("entityType", state.entityType);
    params.set("includeRestored", state.includeRestored ? "1" : "0");
    params.set("page", String(state.page));
    params.set("perPage", String(state.perPage));
    return params;
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

  function humanizeEntityType(value) {
    var normalized = String(value || "").trim().toLowerCase();
    if (normalized === "shop") {
      return "Cửa hàng";
    }
    if (normalized === "staff") {
      return "Nhân viên";
    }
    if (normalized === "installment") {
      return "Trả góp";
    }
    return normalized || "-";
  }

  function statusBadge(item) {
    if (item && item.restoredAt) {
      return '<span class="m-badge m-badge--success m-badge--wide">Da khoi phuc</span>';
    }
    return '<span class="m-badge m-badge--danger m-badge--wide">Da xoa</span>';
  }

  function restoreButton(item) {
    if (!item || item.restoredAt) {
      return '<span class="text-muted">-</span>';
    }
    return (
      '<button class="btn btn-sm btn-brand js-restore-trash" type="button" data-id="' +
      escapeHtml(item.id) +
      '" data-label="' +
      escapeHtml(item.label || "") +
      '" data-entity="' +
      escapeHtml(item.entityType || "") +
      '">Khoi phuc</button>'
    );
  }

  function renderRows(items) {
    if (!Array.isArray(items) || items.length === 0) {
      elements.tableBody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">Chua co ban ghi nao trong thung rac.</td></tr>';
      return;
    }

    elements.tableBody.innerHTML = items
      .map(function (item) {
        return (
          "<tr>" +
          "<td>" +
          escapeHtml(item.deletedAt || "-") +
          "</td>" +
          "<td>" +
          escapeHtml(humanizeEntityType(item.entityType)) +
          "</td>" +
          "<td>" +
          escapeHtml(item.label || "-") +
          "</td>" +
          "<td>" +
          escapeHtml(item.entityId || "-") +
          "</td>" +
          "<td>" +
          escapeHtml(item.deletedBy || "-") +
          "</td>" +
          "<td>" +
          statusBadge(item) +
          (item.restoredAt ? '<div class="trash-row__subtext">' + escapeHtml(item.restoredAt) + "</div>" : "") +
          "</td>" +
          "<td>" +
          restoreButton(item) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderEntityTypeOptions(entityTypes) {
    var currentValue = state.entityType;
    var normalizedValues = [];
    var nextOptions = ['<option value="">Tất cả</option>'];
    (Array.isArray(entityTypes) ? entityTypes : []).forEach(function (entityType) {
      var normalized = String(entityType || "").trim();
      if (!normalized) {
        return;
      }
      normalizedValues.push(normalized);
      nextOptions.push(
        '<option value="' +
          escapeHtml(normalized) +
          '"' +
          (normalized === currentValue ? " selected" : "") +
          ">" +
          escapeHtml(humanizeEntityType(normalized)) +
          "</option>"
      );
    });
    if (currentValue && normalizedValues.indexOf(currentValue) < 0) {
      nextOptions.push(
        '<option value="' +
          escapeHtml(currentValue) +
          '" selected>' +
          escapeHtml(humanizeEntityType(currentValue)) +
          "</option>"
      );
    }
    elements.entityTypeFilter.innerHTML = nextOptions.join("");
  }

  async function loadData() {
    syncState();
    elements.tableBody.innerHTML =
      '<tr><td colspan="7" class="text-center text-muted">Đang tải dữ liệu...</td></tr>';
    try {
      var response = await fetch(config.listUrl + "?" + buildQuery().toString(), {
        headers: { Accept: "application/json" }
      });
      var payload = await readJsonResponse(response);
      if (!response.ok || payload.Result !== 1) {
        throw new Error(payload.Message || "Không thể tải danh sách thùng rác.");
      }

      renderRows(payload.items || []);
      renderEntityTypeOptions(payload.availableEntityTypes || []);
      elements.tableMeta.textContent =
        "Hien thi " +
        formatNumber((payload.items || []).length) +
        " / " +
        formatNumber(payload.total || 0) +
        " dong, trang " +
        formatNumber(payload.page || 1) +
        " / " +
        formatNumber(payload.totalPages || 1);
      renderPagination(Number(payload.totalPages || 1));
    } catch (error) {
      elements.tableBody.innerHTML =
        '<tr><td colspan="7" class="text-center text-danger">Không thể tải dữ liệu. Vui lòng thử lại.</td></tr>';
      notify("Lỗi tải dữ liệu", error instanceof Error ? error.message : "Không thể tải danh sách thùng rác.");
    }
  }

  async function restoreRow(id, entityType, label) {
    if (!id) {
      notify("Dữ liệu không hợp lệ", "Không xác định được bản ghi cần khôi phục.");
      return;
    }

    if (
      !(await askConfirm(
        "Khoi phuc du lieu",
        "Ban muon khoi phuc " +
          humanizeEntityType(entityType) +
          ': "' +
          String(label || "(Không tên)") +
          '"?'
      ))
    ) {
      return;
    }

    try {
      var response = await fetch(config.restoreUrlBase + "/" + encodeURIComponent(id), {
        method: "POST",
        headers: { Accept: "application/json" }
      });
      var payload = await readJsonResponse(response);
      if (!response.ok || payload.Result !== 1) {
        throw new Error(payload.Message || "Không thể khôi phục dữ liệu.");
      }

      notify("Khoi phuc thanh cong", payload.Message || "Da khoi phuc du lieu.");

      await loadData();
    } catch (error) {
      notify("Không thể khôi phục", error instanceof Error ? error.message : "Không thể khôi phục dữ liệu.");
    }
  }

  elements.reloadButton.addEventListener("click", function () {
    state.page = 1;
    loadData();
  });

  elements.entityTypeFilter.addEventListener("change", function () {
    state.page = 1;
    loadData();
  });

  elements.includeRestored.addEventListener("change", function () {
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

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    var restoreButtonElement = target.closest(".js-restore-trash");
    if (!restoreButtonElement) {
      return;
    }

    event.preventDefault();
    restoreRow(
      restoreButtonElement.getAttribute("data-id"),
      restoreButtonElement.getAttribute("data-entity"),
      restoreButtonElement.getAttribute("data-label")
    );
  });

  loadData();
})();
