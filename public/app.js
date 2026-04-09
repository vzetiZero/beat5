(function () {
  var SIDEBAR_COLLAPSED_KEY = "app.sidebar.collapsed";

  function normalizeProxyHelpers() {
    window.serverURI = "/proxy";
    window.get_link_api = function (strPath) {
      return "/proxy/api" + strPath;
    };
    window.get_file_path = function (strPath) {
      return "/proxy/file" + strPath;
    };
  }

  function isDesktopViewport() {
    return window.innerWidth > 992;
  }

  function readSidebarCollapsedState() {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch (error) {
      return false;
    }
  }

  function writeSidebarCollapsedState(isCollapsed) {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isCollapsed ? "true" : "false");
    } catch (error) {
      return;
    }
  }

  function getSidebarItems() {
    return Array.from(document.querySelectorAll(".app-sidebar .m-menu__item[data-sidebar-key]"));
  }

  function applySidebarOpenState(item, shouldOpen) {
    item.classList.toggle("app-sidebar__item--open", shouldOpen);
    item.classList.toggle("m-menu__item--open", shouldOpen);

    var button = item.querySelector(".app-sidebar__dropdown");
    if (button) {
      button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    }
  }

  function restoreSidebarState() {
    var sidebarItems = getSidebarItems();
    var activeItem = sidebarItems.find(function (item) {
      return item.getAttribute("data-sidebar-active") === "true";
    });

    sidebarItems.forEach(function (item) {
      applySidebarOpenState(item, Boolean(activeItem && item === activeItem));
    });
  }

  function closeOtherSidebarItems(currentItem) {
    getSidebarItems().forEach(function (item) {
      if (item !== currentItem) {
        applySidebarOpenState(item, false);
      }
    });
  }

  function initSidebarDropdowns() {
    restoreSidebarState();

    document.querySelectorAll(".app-sidebar__dropdown").forEach(function (button) {
      if (button.dataset.bound === "true") {
        return;
      }

      button.dataset.bound = "true";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        var item = button.closest(".m-menu__item");
        if (!item) {
          return;
        }

        var willOpen = !item.classList.contains("app-sidebar__item--open");
        closeOtherSidebarItems(item);
        applySidebarOpenState(item, willOpen);
      });
    });
  }

  function applyDesktopSidebarCollapsedState(isCollapsed) {
    document.body.classList.toggle("m-aside-left--minimize", isDesktopViewport() && isCollapsed);
  }

  function closeMobileSidebar() {
    document.body.classList.remove("app-sidebar-mobile-open");

    var overlay = document.getElementById("appSidebarOverlay");
    if (overlay) {
      overlay.classList.remove("is-visible");
      overlay.hidden = true;
    }
  }

  function openMobileSidebar() {
    document.body.classList.add("app-sidebar-mobile-open");

    var overlay = document.getElementById("appSidebarOverlay");
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.add("is-visible");
    }
  }

  function initSidebarToggle() {
    if (document.body.dataset.sidebarToggleBound === "true") {
      return;
    }

    document.body.dataset.sidebarToggleBound = "true";
    var toggleButton = document.getElementById("appSidebarToggle");
    var overlay = document.getElementById("appSidebarOverlay");
    var openIcon = toggleButton ? toggleButton.querySelector(".app-topbar__menu-icon--menu") : null;
    var closeIcon = toggleButton ? toggleButton.querySelector(".app-topbar__menu-icon--close") : null;

    function syncToggleIcon() {
      if (!toggleButton) {
        return;
      }

      var isDesktopCollapsed = isDesktopViewport() && document.body.classList.contains("m-aside-left--minimize");
      var isMobileOpen = !isDesktopViewport() && document.body.classList.contains("app-sidebar-mobile-open");
      var showCloseIcon = isMobileOpen;
      var showCollapsedIcon = isDesktopViewport() && isDesktopCollapsed;

      if (openIcon) {
        openIcon.hidden = showCloseIcon || showCollapsedIcon;
      }

      if (closeIcon) {
        closeIcon.hidden = !(showCloseIcon || showCollapsedIcon);
      }

      toggleButton.setAttribute(
        "aria-label",
        isDesktopViewport() ? (isDesktopCollapsed ? "Mo sidebar" : "Thu gon sidebar") : isMobileOpen ? "Dong menu" : "Mo menu"
      );
    }

    if (toggleButton) {
      toggleButton.addEventListener("click", function () {
        if (isDesktopViewport()) {
          var nextCollapsedState = !document.body.classList.contains("m-aside-left--minimize");
          writeSidebarCollapsedState(nextCollapsedState);
          applyDesktopSidebarCollapsedState(nextCollapsedState);
          syncToggleIcon();
          return;
        }

        if (document.body.classList.contains("app-sidebar-mobile-open")) {
          closeMobileSidebar();
          syncToggleIcon();
          return;
        }

        openMobileSidebar();
        syncToggleIcon();
      });
    }

    if (overlay) {
      overlay.addEventListener("click", function () {
        closeMobileSidebar();
        syncToggleIcon();
      });
    }

    document.querySelectorAll(".app-sidebar a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (!isDesktopViewport()) {
          closeMobileSidebar();
        }
      });
    });

    window.addEventListener("resize", function () {
      applyDesktopSidebarCollapsedState(readSidebarCollapsedState());

      if (isDesktopViewport()) {
        closeMobileSidebar();
      }
      syncToggleIcon();
    });

    applyDesktopSidebarCollapsedState(readSidebarCollapsedState());
    syncToggleIcon();
  }

  function initScrollTopButton() {
    var button = document.getElementById("appScrollTop");
    if (!button) {
      return;
    }

    if (button.dataset.bound === "true") {
      return;
    }

    button.dataset.bound = "true";

    function syncVisibility() {
      button.classList.toggle("is-visible", window.scrollY > 320);
    }

    window.addEventListener("scroll", syncVisibility, { passive: true });
    button.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });

    if (!button.querySelector(".app-scroll-top__icon")) {
      var icon = document.createElement("span");
      icon.className = "app-scroll-top__icon";
      icon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 6 11h4v8h4v-8h4z"></path></svg>';
      button.appendChild(icon);
    }

    syncVisibility();
  }

  function formatMoneyInputValue(value) {
    var digits = String(value == null ? "" : value).replace(/[^\d]/g, "");
    if (!digits) {
      return "";
    }
    return Number(digits).toLocaleString("vi-VN") + " ₫";
  }

  function initMoneyInputs() {
    document.querySelectorAll("input[data-money-input='true']").forEach(function (input) {
      if (input.dataset.moneyInitialized === "true") {
        return;
      }

      input.dataset.moneyInitialized = "true";

      function applyFormatting() {
        input.value = formatMoneyInputValue(input.value);
      }

      input.addEventListener("input", applyFormatting);
      input.addEventListener("blur", applyFormatting);
      applyFormatting();
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createDialogApi() {
    var state = {
      root: null,
      backdrop: null,
      panel: null,
      title: null,
      message: null,
      body: null,
      error: null,
      cancelButton: null,
      confirmButton: null,
      iconBadge: null,
      activeClose: null
    };

    function toneMeta(type) {
      if (type === "success") {
        return { key: "success", icon: "check" };
      }
      if (type === "error") {
        return { key: "error", icon: "x" };
      }
      if (type === "warning") {
        return { key: "warning", icon: "warn" };
      }
      return { key: "info", icon: "info" };
    }

    function iconSvg(icon) {
      if (icon === "check") {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7 10 17l-5-5"></path></svg>';
      }
      if (icon === "x") {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"></path></svg>';
      }
      if (icon === "warn") {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.7 20h18.6L12 3zm0 6v5m0 3h.01"></path></svg>';
      }
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8h.01M11 12h2v5h-2zm1-9a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"></path></svg>';
    }

    function ensureRoot() {
      if (state.root && state.root.isConnected) {
        return;
      }

      var root = document.createElement("div");
      root.className = "app-dialog-root";
      root.hidden = true;
      root.innerHTML =
        '<div class="app-dialog-backdrop" data-role="backdrop"></div>' +
        '<div class="app-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="appDialogTitle">' +
        '<div class="app-dialog-header">' +
        '<div class="app-dialog-icon" data-role="icon"></div>' +
        '<div class="app-dialog-heading">' +
        '<h3 id="appDialogTitle" class="app-dialog-title"></h3>' +
        '<p class="app-dialog-message" data-role="message"></p>' +
        "</div>" +
        "</div>" +
        '<div class="app-dialog-body" data-role="body"></div>' +
        '<p class="app-dialog-error" data-role="error" hidden></p>' +
        '<div class="app-dialog-actions">' +
        '<button type="button" class="btn btn-secondary app-dialog-btn app-dialog-btn--cancel" data-role="cancel">Huy</button>' +
        '<button type="button" class="btn btn-brand app-dialog-btn app-dialog-btn--confirm" data-role="confirm">Xac nhan</button>' +
        "</div>" +
        "</div>";

      document.body.appendChild(root);
      state.root = root;
      state.backdrop = root.querySelector('[data-role="backdrop"]');
      state.panel = root.querySelector(".app-dialog-panel");
      state.title = root.querySelector("#appDialogTitle");
      state.message = root.querySelector('[data-role="message"]');
      state.body = root.querySelector('[data-role="body"]');
      state.error = root.querySelector('[data-role="error"]');
      state.cancelButton = root.querySelector('[data-role="cancel"]');
      state.confirmButton = root.querySelector('[data-role="confirm"]');
      state.iconBadge = root.querySelector('[data-role="icon"]');
    }

    function clearStateClasses() {
      if (!state.root) {
        return;
      }
      state.root.classList.remove("app-dialog-root--info", "app-dialog-root--success", "app-dialog-root--warning", "app-dialog-root--error");
    }

    function normalizeText(value) {
      return String(value == null ? "" : value);
    }

    function open(options) {
      ensureRoot();
      if (!state.root || !state.panel || !state.confirmButton || !state.cancelButton || !state.body) {
        return Promise.resolve({ confirmed: false, value: null, reason: "unavailable" });
      }

      if (typeof state.activeClose === "function") {
        state.activeClose({ confirmed: false, value: null, reason: "replaced" });
      }

      return new Promise(function (resolve) {
        var tone = toneMeta(options.type);
        var showCancel = options.showCancel !== false;
        var allowOutsideClick = options.allowOutsideClick !== false;
        var allowEscapeKey = options.allowEscapeKey !== false;
        var inputType = options.inputType || "";
        var valueOptions = Array.isArray(options.options) ? options.options : [];
        var activeInput = null;

        clearStateClasses();
        state.root.classList.add("app-dialog-root--" + tone.key);
        state.iconBadge.innerHTML = iconSvg(tone.icon);
        state.title.textContent = normalizeText(options.title || "");
        state.message.textContent = normalizeText(options.text || "");
        state.message.hidden = !state.message.textContent;
        state.body.innerHTML = "";
        state.error.hidden = true;
        state.error.textContent = "";

        if (inputType === "text") {
          var inputWrap = document.createElement("label");
          inputWrap.className = "app-dialog-field";
          if (options.label) {
            var labelText = document.createElement("span");
            labelText.className = "app-dialog-field__label";
            labelText.textContent = normalizeText(options.label);
            inputWrap.appendChild(labelText);
          }
          var textInput = document.createElement("input");
          textInput.type = "text";
          textInput.className = "form-control app-dialog-field__control";
          textInput.value = normalizeText(options.initialValue || "");
          textInput.placeholder = normalizeText(options.placeholder || "");
          inputWrap.appendChild(textInput);
          state.body.appendChild(inputWrap);
          activeInput = textInput;
        } else if (inputType === "select") {
          var selectWrap = document.createElement("label");
          selectWrap.className = "app-dialog-field";
          if (options.label) {
            var selectLabel = document.createElement("span");
            selectLabel.className = "app-dialog-field__label";
            selectLabel.textContent = normalizeText(options.label);
            selectWrap.appendChild(selectLabel);
          }
          var selectInput = document.createElement("select");
          selectInput.className = "form-control app-dialog-field__control";
          if (options.placeholder) {
            var emptyOption = document.createElement("option");
            emptyOption.value = "";
            emptyOption.textContent = normalizeText(options.placeholder);
            selectInput.appendChild(emptyOption);
          }
          valueOptions.forEach(function (item) {
            var option = document.createElement("option");
            option.value = normalizeText(item.value);
            option.textContent = normalizeText(item.label);
            selectInput.appendChild(option);
          });
          if (options.initialValue != null) {
            selectInput.value = normalizeText(options.initialValue);
          }
          selectWrap.appendChild(selectInput);
          state.body.appendChild(selectWrap);
          activeInput = selectInput;
        }

        state.cancelButton.hidden = !showCancel;
        state.cancelButton.textContent = normalizeText(options.cancelText || "Huy");
        state.confirmButton.textContent = normalizeText(options.confirmText || "Dong");

        function hideError() {
          state.error.hidden = true;
          state.error.textContent = "";
        }

        function showError(message) {
          state.error.hidden = false;
          state.error.textContent = normalizeText(message || "Du lieu khong hop le.");
        }

        function close(result) {
          if (!state.root) {
            resolve(result);
            return;
          }
          state.root.classList.remove("is-open");
          document.body.classList.remove("app-dialog-open");
          window.removeEventListener("keydown", onKeydown);
          state.backdrop.removeEventListener("click", onBackdropClick);
          state.cancelButton.removeEventListener("click", onCancelClick);
          state.confirmButton.removeEventListener("click", onConfirmClick);
          state.activeClose = null;
          window.setTimeout(function () {
            if (state.root && !state.root.classList.contains("is-open")) {
              state.root.hidden = true;
            }
          }, 180);
          resolve(result);
        }

        function getValue() {
          if (!activeInput) {
            return true;
          }
          return normalizeText(activeInput.value);
        }

        function validate(value) {
          hideError();
          if (options.required && !normalizeText(value).trim()) {
            showError(options.requiredMessage || "Vui lòng nhập đầy đủ thông tin.");
            return false;
          }
          if (typeof options.validate === "function") {
            var validationMessage = options.validate(value);
            if (validationMessage) {
              showError(validationMessage);
              return false;
            }
          }
          return true;
        }

        function onConfirmClick() {
          var value = getValue();
          if (!validate(value)) {
            if (activeInput) {
              activeInput.focus();
            }
            return;
          }
          close({ confirmed: true, value: value, reason: "confirm" });
        }

        function onCancelClick() {
          close({ confirmed: false, value: null, reason: "cancel" });
        }

        function onBackdropClick() {
          if (!allowOutsideClick) {
            return;
          }
          close({ confirmed: false, value: null, reason: "outside" });
        }

        function onKeydown(event) {
          if (event.key === "Escape") {
            if (!allowEscapeKey) {
              return;
            }
            event.preventDefault();
            close({ confirmed: false, value: null, reason: "escape" });
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            var target = event.target;
            if (target instanceof HTMLTextAreaElement) {
              return;
            }
            if (state.root && state.root.classList.contains("is-open")) {
              event.preventDefault();
              onConfirmClick();
            }
          }
        }

        state.activeClose = close;
        state.backdrop.addEventListener("click", onBackdropClick);
        state.cancelButton.addEventListener("click", onCancelClick);
        state.confirmButton.addEventListener("click", onConfirmClick);
        window.addEventListener("keydown", onKeydown);

        state.root.hidden = false;
        document.body.classList.add("app-dialog-open");
        window.requestAnimationFrame(function () {
          if (!state.root) {
            return;
          }
          state.root.classList.add("is-open");
          if (activeInput) {
            activeInput.focus();
          } else {
            state.confirmButton.focus();
          }
        });
      });
    }

    function alertDialog(options) {
      var settings = options || {};
      return open({
        title: settings.title || "Thông báo",
        text: settings.text || "",
        type: settings.type || "info",
        showCancel: false,
        confirmText: settings.confirmText || "Đóng",
        allowOutsideClick: true,
        allowEscapeKey: true
      }).then(function () {
        return undefined;
      });
    }

    function confirmDialog(options) {
      var settings = options || {};
      return open({
        title: settings.title || "Xác nhận",
        text: settings.text || "",
        type: settings.type || "warning",
        showCancel: true,
        confirmText: settings.confirmText || "Xác nhận",
        cancelText: settings.cancelText || "Hủy",
        allowOutsideClick: false,
        allowEscapeKey: true
      }).then(function (result) {
        return Boolean(result && result.confirmed);
      });
    }

    function promptDialog(options) {
      var settings = options || {};
      return open({
        title: settings.title || "Nhập thông tin",
        text: settings.text || "",
        type: settings.type || "info",
        showCancel: true,
        confirmText: settings.confirmText || "Đồng ý",
        cancelText: settings.cancelText || "Hủy",
        allowOutsideClick: false,
        allowEscapeKey: true,
        inputType: "text",
        label: settings.label || "",
        placeholder: settings.placeholder || "",
        initialValue: settings.initialValue || "",
        required: Boolean(settings.required),
        requiredMessage: settings.requiredMessage || "",
        validate: settings.validate
      }).then(function (result) {
        if (!result || !result.confirmed) {
          return null;
        }
        return normalizeText(result.value);
      });
    }

    function selectDialog(options) {
      var settings = options || {};
      return open({
        title: settings.title || "Chọn dữ liệu",
        text: settings.text || "",
        type: settings.type || "info",
        showCancel: true,
        confirmText: settings.confirmText || "Đồng ý",
        cancelText: settings.cancelText || "Hủy",
        allowOutsideClick: false,
        allowEscapeKey: true,
        inputType: "select",
        label: settings.label || "",
        placeholder: settings.placeholder || "",
        initialValue: settings.initialValue || "",
        options: Array.isArray(settings.options) ? settings.options : [],
        required: settings.required !== false,
        requiredMessage: settings.requiredMessage || "Vui lòng chọn một giá trị."
      }).then(function (result) {
        if (!result || !result.confirmed) {
          return null;
        }
        return normalizeText(result.value);
      });
    }

    return {
      alert: alertDialog,
      confirm: confirmDialog,
      prompt: promptDialog,
      select: selectDialog
    };
  }

  var appDialog = createDialogApi();
  window.AppDialog = appDialog;

  function flashAccent(type) {
    if (type === "success") {
      return "#0f9d58";
    }
    if (type === "error") {
      return "#d93025";
    }
    if (type === "warning") {
      return "#f29900";
    }
    return "#1a73e8";
  }

  function showFlashToast(flash) {
    if (!document.body) {
      return;
    }

    var title = String(flash.title || "");
    var text = String(flash.text || "");
    var accent = flashAccent(flash.type);
    var timerValue = Number(flash.timer);
    var timeoutMs = Number.isFinite(timerValue) && timerValue > 0 ? timerValue : 2200;

    var toast = document.createElement("div");
    toast.className = "app-native-flash-toast";
    toast.setAttribute("role", "status");
    toast.style.position = "fixed";
    toast.style.top = "18px";
    toast.style.right = "18px";
    toast.style.maxWidth = "360px";
    toast.style.zIndex = "2147483647";
    toast.style.padding = "12px 14px";
    toast.style.borderRadius = "12px";
    toast.style.background = "#ffffff";
    toast.style.border = "1px solid rgba(15, 23, 42, 0.12)";
    toast.style.boxShadow = "0 14px 34px rgba(15, 23, 42, 0.2)";
    toast.style.color = "#0f172a";
    toast.style.lineHeight = "1.45";
    toast.style.fontFamily = "inherit";
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    toast.style.transition = "opacity 160ms ease, transform 160ms ease";
    toast.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:10px;">' +
      '<span aria-hidden="true" style="margin-top:2px;width:10px;height:10px;border-radius:50%;background:' +
      accent +
      ';flex:0 0 auto;"></span>' +
      '<div style="min-width:0;">' +
      (title ? '<div style="font-weight:700;font-size:14px;">' + escapeHtml(title) + "</div>" : "") +
      (text ? '<div style="margin-top:2px;font-size:13px;">' + escapeHtml(text) + "</div>" : "") +
      "</div></div>";

    document.body.appendChild(toast);
    window.requestAnimationFrame(function () {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    window.setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-6px)";
      window.setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 180);
    }, timeoutMs);
  }

  function showFlashAlert(flash) {
    appDialog.alert({
      title: flash.title || "Thông báo",
      text: flash.text || "",
      type: flash.type || "info",
      confirmText: flash.confirmButtonText || "Đóng"
    });
  }

  normalizeProxyHelpers();
  initSidebarDropdowns();
  initSidebarToggle();
  initScrollTopButton();
  initMoneyInputs();
  window.addEventListener("load", function () {
    normalizeProxyHelpers();
    initSidebarDropdowns();
    initSidebarToggle();
    initScrollTopButton();
    initMoneyInputs();
  });

  if (!window.__FLASH__) {
    return;
  }

  var flash = window.__FLASH__;
  if (flash.mode === "toast") {
    showFlashToast(flash);
    return;
  }

  if (flash.mode === "login-success") {
    showFlashToast({
      type: "success",
      title: flash.title || "Đăng nhập thành công",
      text: flash.text || "Bạn đã đăng nhập vào hệ thống.",
      timer: flash.timer || 2500
    });
    return;
  }

  showFlashAlert(flash);
})();
