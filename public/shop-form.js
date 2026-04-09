(function () {
  var config = window.__SHOP_FORM__ || {};
  var provinceSelect = document.getElementById("shopProvinceCode");
  var wardSelect = document.getElementById("shopWardCode");
  var detailInput = document.getElementById("shopAddressDetail");
  var districtInput = document.getElementById("shopDistrictName");
  var preview = document.getElementById("shopAddressPreview");
  var totalMoneyInput = document.getElementById("shopTotalMoney");

  if (!provinceSelect || !wardSelect || !detailInput || !districtInput || !preview) {
    return;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function notify(title, text, type) {
    if (window.AppDialog && typeof window.AppDialog.alert === "function") {
      window.AppDialog.alert({
        title: title,
        text: text,
        type: type || "error",
        confirmText: "Đóng"
      });
      return;
    }
    window.alert([title, text].filter(Boolean).join("\n"));
  }

  async function readJsonResponse(response) {
    var text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        throw new Error("API địa giới đang trả về HTML thay vì JSON.");
      }
      throw error;
    }
  }

  function createOption(value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function getSelectedLabel(selectElement) {
    if (!selectElement.value) {
      return "";
    }

    var selectedOption = selectElement.options[selectElement.selectedIndex];
    return selectedOption ? selectedOption.text.trim() : "";
  }

  function formatCurrencyInputValue(value) {
    var digits = String(value == null ? "" : value).replace(/[^\d]/g, "");
    if (!digits) {
      return "";
    }

    return Number(digits).toLocaleString("vi-VN") + " ₫";
  }

  function normalizeCurrencyInput() {
    if (!totalMoneyInput) {
      return;
    }

    totalMoneyInput.value = formatCurrencyInputValue(totalMoneyInput.value);
  }

  function renderPreview() {
    var parts = [
      detailInput.value.trim(),
      districtInput.value.trim(),
      getSelectedLabel(wardSelect),
      getSelectedLabel(provinceSelect)
    ].filter(Boolean);

    preview.innerHTML = escapeHtml(parts.join(", ") || config.existingAddress || "Chưa có địa chỉ được tạo.");
  }

  async function loadWards(provinceCode, selectedWardCode) {
    wardSelect.innerHTML = "";
    wardSelect.appendChild(createOption("", provinceCode ? "Đang tải phường / xã..." : "Chọn phường / xã"));
    wardSelect.disabled = !provinceCode;
    renderPreview();

    if (!provinceCode) {
      return;
    }

    try {
      var response = await fetch(
        config.wardListUrl + "?provinceCode=" + encodeURIComponent(provinceCode),
        { headers: { Accept: "application/json" } }
      );
      var payload = await readJsonResponse(response);
      if (!response.ok || payload.Result !== 1) {
        throw new Error(payload.Message || "Không thể tải danh sách phường / xã.");
      }

      wardSelect.innerHTML = "";
      wardSelect.appendChild(createOption("", "Chọn phường / xã"));
      payload.items.forEach(function (item) {
        var option = createOption(item.code, item.name);
        if (selectedWardCode && item.code === selectedWardCode) {
          option.selected = true;
        }
        wardSelect.appendChild(option);
      });
      wardSelect.disabled = false;
      renderPreview();
    } catch (error) {
      wardSelect.innerHTML = "";
      wardSelect.appendChild(createOption("", "Không tải được dữ liệu phường / xã"));
      wardSelect.disabled = true;
      renderPreview();
      notify("Lỗi tải địa giới", error instanceof Error ? error.message : "Không thể tải dữ liệu phường / xã.");
    }
  }

  provinceSelect.addEventListener("change", function () {
    loadWards(provinceSelect.value, "");
  });

  wardSelect.addEventListener("change", renderPreview);
  detailInput.addEventListener("input", renderPreview);
  districtInput.addEventListener("input", renderPreview);

  if (totalMoneyInput) {
    totalMoneyInput.addEventListener("input", normalizeCurrencyInput);
    totalMoneyInput.addEventListener("blur", normalizeCurrencyInput);
    normalizeCurrencyInput();
  }

  loadWards(config.selectedProvinceCode || provinceSelect.value, config.selectedWardCode || wardSelect.value);
  renderPreview();
})();
