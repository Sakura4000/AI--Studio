(function () {
  "use strict";

  if (window.__galaUiEnhancementsLoaded) return;
  window.__galaUiEnhancementsLoaded = true;

  const PAGE_CONFIGS = {
    image: {
      key: "image",
      route: "online",
      title: "在线生图",
      root: ".online-page__inner",
      header: ".online-page__header",
      workspace: ".online-page__workspace",
      input: ".online-page__input-panel",
      inputScroll: ".online-page__input-scroll",
      result: ".online-page__result-panel",
      queue: ".online-page__queue-panel",
      endpoint: "/api/online-image-tasks",
      prompt: true,
      hideReference: /参考图片.*图[123]|参考视频.*视频[123]/,
    },
    video: {
      key: "video",
      route: "online-video",
      title: "在线生视频",
      root: ".online-video-page__inner",
      header: ".online-video-page__header",
      workspace: ".online-video-workspace",
      input: ".online-video-input",
      inputScroll: ".online-video-input__scroll",
      result: ".online-video-result",
      queue: ".online-video-queue",
      endpoint: "/api/online-video-tasks",
      prompt: true,
      hideReference: /参考图片.*图[123]|参考视频.*视频[123]/,
    },
    enhance: {
      key: "enhance",
      route: "enhance",
      title: "细节增强",
      root: ".enhance-page__inner",
      header: ".enhance-page__header",
      workspace: ".enhance-page__workspace",
      input: ".enhance-page__input-panel",
      inputScroll: ".enhance-page__input-scroll",
      result: ".enhance-page__result-panel",
      queue: ".enhance-page__queue-panel",
      endpoint: "/api/enhance/tasks",
      prompt: false,
    },
    angle: {
      key: "angle",
      route: "angle",
      title: "角度控制",
      root: ".angle-page__inner",
      header: ".angle-page__header",
      workspace: ".angle-page__workspace",
      input: ".angle-page__input-panel",
      inputScroll: ".angle-page__input-scroll",
      result: ".angle-page__result-panel",
      queue: ".angle-page__queue-panel",
      endpoint: "/api/angle/tasks",
      prompt: false,
    },
  };

  const taskStates = new Map();
  const attachmentStates = new Map();
  const attachmentPreviewUrls = new Map();
  const wan30UrlStates = new Map();
  const wan30ModelOverrides = new Map();
  const taskEndpoints = Object.values(PAGE_CONFIGS).map((config) => config.endpoint);
  let activeContext = null;
  let applyFrame = 0;
  let mentionPopover = null;
  let wan30UrlPopover = null;
  let taskModal = null;
  let nativeFetch = null;
  let activePromptModelField = null;
  let promptAttachmentSourceMenu = null;
  let variableSelectionFrame = 0;
  let variableSelectionPointerDown = false;
  let enhanceMultiUploadItems = [];
  let enhanceMultiUploadLimitNotice = "";
  let enhanceMultiUploadStarted = false;
  let canvasPendingFileUploads = [];
  let canvasUploadTargetNodeId = "";
  let canvasPrototypeUploadSequence = 0;
  const CANVAS_UPLOAD_EVENT_HANDLED = Symbol("galaCanvasUploadEventHandled");
  const CANVAS_UPLOAD_NODE_DEFAULT_SIZE = Object.freeze({ width: 340, height: 420 });
  const canvasPrototypeUploadFrameSize = { width: 0, height: 0 };
  const canvasFileNodeStates = new Map();
  const canvasPrototypeUploadStates = new Map();
  const canvasPrototypeUploadUrls = new Map();
  const canvasPrototypeUploadSizes = new Map();
  const attachmentReviewStates = new Map();
  let attachmentToastTimer = 0;
  let attachmentReviewLastOutcome = "";
  let attachmentReviewSameOutcomeCount = 0;
  const canvasLayerDecompositionStates = new Map();
  const canvasLayerDecompositionNodeKeys = new WeakMap();
  const canvasLayerDecompositionOutputs = new Map();
  let canvasLayerDecompositionSequence = 0;
  let canvasLayerExtractSequence = 0;
  let canvasLayerDecompositionPanel = null;
  let canvasLayerDecompositionViewer = null;
  let canvasLayerOutputPreview = null;
  let volcLibraryModal = null;
  let volcLibraryTarget = null;
  let volcLibraryAssetSequence = 0;
  const volcLibraryAssets = [];
  const volcLibraryPreviewUrls = new Map();

  const CANVAS_UPLOAD_LABEL = "\u4e0a\u4f20\u56fe\u7247/\u89c6\u9891/\u97f3\u9891/\u6587\u4ef6";
  const CANVAS_UPLOAD_HINT = "\u70b9\u51fb\u6216\u62d6\u62fd\u4e0a\u4f20\u56fe\u7247/\u89c6\u9891/\u97f3\u9891/\u6587\u4ef6";
  const CANVAS_FILE_INPUT_ERROR = "\u5f53\u524d\u6a21\u578b\u4e0d\u652f\u6301\u6587\u4ef6\u8f93\u5165\uff0c\u8bf7\u5207\u6362\u5230 Wan 3.0 Video\u3002";

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function modelTextIn(scope) {
    if (!scope) return "";
    if (scope.dataset?.galaWanModelOverride === "true"
      || scope.querySelector("[data-gala-wan-model-override=\"true\"]")) {
      return "wan3.0-video";
    }
    const fields = Array.from(scope.querySelectorAll(
      ".model-select, .prompt-generation-model-field, [data-model], [role=combobox]",
    ));
    const fieldText = fields.map((field) => cleanText(field.textContent)).filter(Boolean).join(" ");
    return fieldText || cleanText(scope.textContent);
  }

  function isVolcModelScope(scope) {
    return /火山|volcengine|seedance|seedream/i.test(modelTextIn(scope));
  }

  function isVolcProviderReviewContext(context) {
    return context?.config?.key === "video";
  }

  function isWan30VideoContext(context) {
    if (!context || context.config?.key !== "video") return false;
    const scope = context.inputScroll || context.input;
    return /wan\s*3(?:\.0|0)?(?:[-\s.]?video)?/i.test(modelTextIn(scope));
  }

  function isWan30CanvasVideoNode(node) {
    if (!node || !node.classList.contains("video-node")) return false;
    return /wan\s*3(?:\.0|0)?(?:[-\s.]?video)?/i.test(modelTextIn(node));
  }

  function isVisibleElement(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findWan30ModelTrigger(scope, isCanvas = false) {
    if (!scope) return null;
    const selectors = isCanvas
      ? [
        ".video-model.model-select button",
        ".video-model.model-select [role=combobox]",
        ".video-model.model-select [data-slot=select-trigger]",
        ".video-model.model-select .select-lite",
      ]
      : [
        ".model-select button",
        ".model-select [role=combobox]",
        "button[role=combobox]",
        "[role=combobox]",
        "[data-slot=select-trigger]",
      ];
    const candidates = Array.from(scope.querySelectorAll(selectors.join(",")))
      .filter(isVisibleElement);
    return candidates[0] || null;
  }

  function getWan30ModelKey(owner, fallbackKey) {
    if (fallbackKey) return String(fallbackKey);
    if (owner?.classList.contains("canvas-node")) {
      return owner.dataset.canvasNodeId || owner.dataset.id || "canvas-video";
    }
    return "online-video";
  }

  function setWan30ModelLabel(trigger) {
    if (!trigger) return;
    const value = trigger.querySelector("[data-slot=select-value], [data-radix-select-value]");
    if (value) {
      value.textContent = "Wan 3.0 Video";
      return;
    }
    const label = trigger.querySelector("[data-gala-wan-model-label]")
      || Array.from(trigger.querySelectorAll("span")).find((item) => cleanText(item.textContent));
    if (label) {
      label.textContent = "Wan 3.0 Video";
      label.dataset.galaWanModelLabel = "true";
      return;
    }
    const appended = document.createElement("span");
    appended.dataset.galaWanModelLabel = "true";
    appended.textContent = "Wan 3.0 Video";
    trigger.appendChild(appended);
  }

  function applyWan30ModelOverride(trigger, owner, key, refreshInputs = true) {
    if (!trigger || !owner) return;
    const stateKey = getWan30ModelKey(owner, key);
    wan30ModelOverrides.set(stateKey, true);
    owner.dataset.galaWanModelOverride = "true";
    trigger.dataset.galaWanModelOverride = "true";
    trigger.dataset.galaModelOverride = "wan3.0-video";
    setWan30ModelLabel(trigger);

    if (!refreshInputs) return;

    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    trigger.blur();

    window.setTimeout(() => {
      if (owner.classList.contains("canvas-node")) {
        setupCanvasWan30Inputs();
      } else {
        const context = findPageContext();
        if (context?.config?.key === "video") setupWan30VideoInput(context);
      }
    }, 0);
  }

  function findOpenWan30ModelMenu(owner) {
    const menus = Array.from(document.querySelectorAll(
      "[role=listbox], .node-select-popup, [data-radix-select-content], [data-slot=select-popup], [data-slot=select-list]",
    )).filter(isVisibleElement);
    if (!menus.length) return null;
    const lists = menus.filter((menu) => menu.matches("[role=listbox], [data-slot=select-list]"));
    const candidates = lists.length ? lists : menus;
    return candidates.find((menu) => owner?.contains(menu)) || candidates[candidates.length - 1];
  }

  function appendWan30ModelOption(trigger, owner, key) {
    const menu = findOpenWan30ModelMenu(owner);
    if (!menu) return;
    let option = menu.querySelector("[data-gala-wan30-model-option]");
    if (!option) {
      const reference = menu.querySelector("[role=option], .node-select-item");
      option = document.createElement(reference?.tagName?.toLowerCase() || "div");
      option.className = `${reference?.className || ""} gala-wan30-model-option`.trim();
      option.dataset.galaWan30ModelOption = "true";
      option.setAttribute("role", "option");
      const indicator = document.createElement("span");
      indicator.className = "gala-wan30-model-option-indicator";
      indicator.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "gala-wan30-model-option-label";
      label.textContent = "Wan 3.0 Video";
      option.append(indicator, label);
      option.addEventListener("pointerdown", (event) => event.stopPropagation());
      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyWan30ModelOverride(trigger, owner, key);
      }, true);
      menu.appendChild(option);
    }
  }

  function setupWan30ModelChoices() {
    if (getRouteName() === "online-video") {
      const context = findPageContext();
      const owner = context?.inputScroll || context?.input;
      const trigger = findWan30ModelTrigger(owner);
      if (trigger && owner) {
        const key = getWan30ModelKey(owner, "online-video");
        if (!trigger.dataset.galaWan30ModelChoiceBound) {
          trigger.dataset.galaWan30ModelChoiceBound = "true";
          trigger.addEventListener("click", () => {
            window.requestAnimationFrame(() => appendWan30ModelOption(trigger, owner, key));
          });
        }
        if (wan30ModelOverrides.get(key)) applyWan30ModelOverride(trigger, owner, key, false);
      }
    }

    if (getRouteName() !== "canvas") return;
    Array.from(document.querySelectorAll(".canvas-node.video-node")).forEach((node) => {
      const trigger = findWan30ModelTrigger(node, true);
      if (!trigger) return;
      const key = getWan30ModelKey(node);
      if (!trigger.dataset.galaWan30ModelChoiceBound) {
        trigger.dataset.galaWan30ModelChoiceBound = "true";
        trigger.addEventListener("click", () => {
          window.requestAnimationFrame(() => appendWan30ModelOption(trigger, node, key));
        });
      }
      if (wan30ModelOverrides.get(key)) applyWan30ModelOverride(trigger, node, key, false);
    });
  }

  function getWan30UrlState(key) {
    const stateKey = String(key || "video");
    if (!wan30UrlStates.has(stateKey)) wan30UrlStates.set(stateKey, { value: "" });
    return wan30UrlStates.get(stateKey);
  }

  function closeWan30UrlPopover() {
    if (wan30UrlPopover?.node?.isConnected) wan30UrlPopover.node.remove();
    wan30UrlPopover = null;
  }

  function positionWan30UrlPopover(popover, anchor) {
    if (!popover || !anchor || !popover.isConnected) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 28);
    const left = Math.max(14, Math.min(rect.left - 12, window.innerWidth - width - 14));
    const popoverHeight = popover.offsetHeight || 150;
    const belowTop = rect.bottom + 8;
    const top = belowTop + popoverHeight <= window.innerHeight - 14
      ? belowTop
      : Math.max(14, rect.top - popoverHeight - 8);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.style.width = `${width}px`;
  }

  function openWan30UrlPopover(context, anchor, onCommit) {
    if (!context || !anchor) return;
    closeWan30UrlPopover();

    const key = context.config?.key || context.key || "video";
    const state = getWan30UrlState(key);
    const node = document.createElement("div");
    node.className = "gala-wan30-url-popover";
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-label", "\u516c\u7f51 URL");

    const title = document.createElement("strong");
    title.className = "gala-wan30-url-popover-title";
    title.textContent = "\u516c\u7f51 URL";

    const input = document.createElement("input");
    input.type = "url";
    input.className = "gala-wan30-url-input";
    input.placeholder = "https://example.com/video";
    input.value = state.value;
    input.setAttribute("aria-label", "\u516c\u7f51 URL");

    const helper = document.createElement("span");
    helper.className = "gala-wan30-url-helper";
    helper.textContent = "\u652f\u6301 1 \u6761\u516c\u7f51 URL\uff0c\u53ef\u4e0e 1 \u4e2a\u6587\u4ef6\u540c\u65f6\u4f7f\u7528";

    const actions = document.createElement("div");
    actions.className = "gala-wan30-url-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "gala-wan30-url-cancel";
    cancel.textContent = "\u53d6\u6d88";
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "gala-wan30-url-confirm";
    confirm.textContent = "\u786e\u5b9a";
    actions.append(cancel, confirm);
    node.append(title, input, helper, actions);
    document.body.appendChild(node);
    wan30UrlPopover = { node, anchor, key };

    const commit = () => {
      const value = cleanText(input.value);
      if (value && !/^https?:\/\//i.test(value)) {
        input.setCustomValidity("\u8bf7\u8f93\u5165 http:// \u6216 https:// \u5f00\u5934\u7684 URL");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      state.value = value;
      onCommit?.(value);
      closeWan30UrlPopover();
    };

    cancel.addEventListener("click", closeWan30UrlPopover);
    confirm.addEventListener("click", commit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeWan30UrlPopover();
      }
    });

    window.requestAnimationFrame(() => {
      positionWan30UrlPopover(node, anchor);
      input.focus();
      input.select();
    });
  }

  const MEDIA_PREVIEW_SELECTOR = [
    ".image-editor-dialog-shell.is-preview-shell",
    ".video-editor-dialog--preview",
    ".asset-lightbox",
  ].join(", ");

  const MEDIA_PREVIEW_CLOSE_SELECTOR = [
    ".image-editor-dialog-shell__close",
    ".video-editor-dialog__header > button",
    ".asset-lightbox-close",
  ].join(", ");

  function isMediaPreviewControl(target) {
    return Boolean(target.closest(
      "button, a, input, select, textarea, [role=button], " +
      ".image-editor-mode-tabs, .image-editor-tool-toolbar, .image-editor-zoom-controls, " +
      ".image-editor-dialog-shell__footer, .video-preview-controls, .video-trim-dock",
    ));
  }

  function isInsidePreviewMedia(dialog, event) {
    const x = event.clientX;
    const y = event.clientY;
    return Array.from(dialog.querySelectorAll("img, video, canvas")).some((media) => {
      const rect = media.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
  }

  function installMediaPreviewBlankDismiss() {
    if (window.__galaMediaPreviewBlankDismissInstalled) return;
    window.__galaMediaPreviewBlankDismissInstalled = true;

    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const dialog = target?.closest(MEDIA_PREVIEW_SELECTOR);
      if (!target || !dialog) return;

      const close = dialog.querySelector(MEDIA_PREVIEW_CLOSE_SELECTOR);
      if (!close || isMediaPreviewControl(target) || isInsidePreviewMedia(dialog, event)) return;
      close.click();
    }, true);
  }

  function getRouteName() {
    const hashRoute = cleanText(window.location.hash).replace(/^#\/?/, "");
    if (hashRoute) return hashRoute.split(/[?&]/)[0].replace(/^\/+/, "");
    const pathRoute = cleanText(window.location.pathname).split("/").filter(Boolean).pop();
    return pathRoute || "online";
  }

  function getPageConfig() {
    const route = getRouteName();
    return Object.values(PAGE_CONFIGS).find((config) => route === config.route || route.endsWith(`/${config.route}`)) || PAGE_CONFIGS.image;
  }

  function findPageContext() {
    const config = getPageConfig();
    const root = document.querySelector(config.root);
    if (!root) return null;

    const workspace = root.querySelector(config.workspace) || document.querySelector(config.workspace);
    if (!workspace) return null;

    return {
      config,
      root,
      header: root.querySelector(config.header) || root.querySelector("header"),
      workspace,
      input: root.querySelector(config.input) || workspace.querySelector(config.input),
      inputScroll: root.querySelector(config.inputScroll) || workspace.querySelector(config.inputScroll),
      result: root.querySelector(config.result) || workspace.querySelector(config.result),
      queue: root.querySelector(config.queue) || workspace.querySelector(config.queue),
    };
  }

  function getTaskState(endpoint) {
    let state = taskStates.get(endpoint);
    if (!state) {
      state = {
        tasks: new Map(),
        success: 0,
        failed: 0,
        hasInitialSnapshot: false,
        lastUpdated: 0,
      };
      taskStates.set(endpoint, state);
    }
    return state;
  }

  function requestInfo(input, init) {
    let rawUrl = "";
    if (typeof input === "string") rawUrl = input;
    else if (input && input.url) rawUrl = input.url;
    let pathname = rawUrl;
    try {
      pathname = new URL(rawUrl || window.location.href, window.location.href).pathname;
    } catch (_error) {
      pathname = rawUrl || "";
    }

    const method = cleanText((init && init.method) || (input && input.method) || "GET").toUpperCase();
    return { pathname, method };
  }

  function endpointForPath(pathname) {
    return taskEndpoints.find((endpoint) => pathname.includes(endpoint)) || null;
  }

  function normalizeStatus(value, item) {
    let status = cleanText(value || "").toLowerCase();
    if (!status && item) {
      if (item.failed === true || item.error) status = "failed";
      else if (item.success === true || item.completed === true || item.done === true) status = "success";
      else status = "pending";
    }
    return status || "pending";
  }

  function taskStatus(item) {
    if (!item || typeof item !== "object") return "pending";
    return normalizeStatus(item.status || item.state || item.task_status || item.taskState || item.phase, item);
  }

  function taskIdentity(item) {
    if (!item || typeof item !== "object") return "";
    const value = item.task_id || item.generation_task_id || item.taskId || item.generationTaskId || item.id;
    return value === undefined || value === null ? "" : String(value);
  }

  function hasTaskShape(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const identity = taskIdentity(item);
    if (!identity) return false;
    return Boolean(
      item.status ||
      item.state ||
      item.task_status ||
      item.phase ||
      item.prompt ||
      item.input_prompt ||
      item.created_at ||
      item.updated_at ||
      item.progress !== undefined ||
      item.task_id ||
      item.generation_task_id,
    );
  }

  function collectTaskItems(value, output, seen, depth) {
    if (!value || typeof value !== "object" || depth > 6) return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach((item) => collectTaskItems(item, output, seen, depth + 1));
      return;
    }

    if (hasTaskShape(value)) output.push(value);

    Object.entries(value).forEach(([key, nested]) => {
      if (!nested || typeof nested !== "object") return;
      if (
        depth < 4 ||
        /^(data|items|tasks|results|records|list|task|payload|output|generations?)$/i.test(key)
      ) {
        collectTaskItems(nested, output, seen, depth + 1);
      }
    });
  }

  function taskItemsFromPayload(payload) {
    const output = [];
    collectTaskItems(payload, output, new Set(), 0);
    const unique = new Map();
    output.forEach((item) => {
      const id = taskIdentity(item);
      if (id && !unique.has(id)) unique.set(id, item);
    });
    return Array.from(unique.values());
  }

  function statusCategory(status) {
    const value = cleanText(status).toLowerCase();
    if (/(fail|error|reject|cancel|timeout|expire|abort|失败|错误|取消|超时)/i.test(value)) return "failed";
    if (/(success|succeed|complete|completed|done|finished|ready|成功|完成)/i.test(value)) return "success";
    return "running";
  }

  function ingestTasks(endpoint, payload, method) {
    if (!endpoint) return;
    const state = getTaskState(endpoint);
    const isSnapshot = method === "GET" && !state.hasInitialSnapshot;
    if (isSnapshot) state.hasInitialSnapshot = true;

    taskItemsFromPayload(payload).forEach((item) => {
      const id = taskIdentity(item);
      if (!id) return;

      const status = taskStatus(item);
      const category = statusCategory(status);
      let saved = state.tasks.get(id);
      if (!saved) {
        saved = {
          id,
          status,
          category,
          raw: item,
          updatedAt: item.updated_at || item.updatedAt || item.created_at || item.createdAt || Date.now(),
          counted: {},
        };
        state.tasks.set(id, saved);
      } else {
        saved.status = status;
        saved.category = category;
        saved.raw = item;
        saved.updatedAt = item.updated_at || item.updatedAt || saved.updatedAt || Date.now();
      }

      if (category === "success" || category === "failed") {
        if (!saved.counted[category]) {
          saved.counted[category] = true;
          if (!isSnapshot) state[category] += 1;
        }
      }
    });

    state.lastUpdated = Date.now();
    if (activeContext) updateTaskToolbar(activeContext);
    if (taskModal && !taskModal.backdrop.hidden) renderTaskModal(activeContext);
  }

  function installFetchInstrumentation() {
    const existing = window.fetch;
    if (!existing || existing.__galaTaskInstrumented) return;

    nativeFetch = existing.bind(window);
    window.__galaNativeFetch = nativeFetch;

    const wrappedFetch = function (input, init) {
      const info = requestInfo(input, init);
      return nativeFetch(input, init).then((response) => {
        const endpoint = endpointForPath(info.pathname);
        if (endpoint) {
          response
            .clone()
            .json()
            .then((payload) => ingestTasks(endpoint, payload, info.method))
            .catch(() => undefined);
        }
        return response;
      });
    };

    wrappedFetch.__galaTaskInstrumented = true;
    window.fetch = wrappedFetch;
  }

  function createStat(label, key, className) {
    const element = document.createElement("span");
    element.className = `gala-task-stat ${className}`;
    element.dataset.galaTaskStat = key;
    element.textContent = label;
    const count = document.createElement("b");
    count.textContent = "0";
    element.appendChild(count);
    return element;
  }

  function ensureTaskToolbar(context) {
    const host = context.header || context.root;
    if (!host) return null;

    let toolbar = host.querySelector(":scope > .gala-task-toolbar");
    if (!toolbar) toolbar = host.querySelector(".gala-task-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "gala-task-toolbar";
      toolbar.append(
        createStat("进行中：", "running", "gala-task-stat-running"),
        createStat("成功任务：", "success", "gala-task-stat-success"),
        createStat("失败任务：", "failed", "gala-task-stat-failed"),
      );

      const detailsButton = document.createElement("button");
      detailsButton.type = "button";
      detailsButton.className = "gala-task-details-button";
      detailsButton.dataset.galaTaskDetails = "true";
      detailsButton.setAttribute("aria-label", `${context.config.title}任务详情`);
      detailsButton.textContent = "任务详情";
      toolbar.appendChild(detailsButton);
      host.appendChild(toolbar);
    }

    toolbar.dataset.galaPage = context.config.key;
    const detailsButton = toolbar.querySelector("[data-gala-task-details]");
    if (detailsButton && !detailsButton.dataset.galaBound) {
      detailsButton.dataset.galaBound = "true";
      detailsButton.addEventListener("click", () => openTaskModal(findPageContext() || context));
    }
    return toolbar;
  }

  function countRunningTasks(context, state) {
    if (state && state.tasks.size) {
      return Array.from(state.tasks.values()).filter((task) => task.category === "running").length;
    }

    if (!context || !context.queue) return 0;
    const visibleTaskNodes = context.queue.querySelectorAll("[data-task-id], [data-task-status], article");
    if (!visibleTaskNodes.length) return 0;
    const queueText = cleanText(context.queue.textContent);
    if (/暂无|没有|无运行|无任务/.test(queueText)) return 0;
    return visibleTaskNodes.length;
  }

  function updateTaskToolbar(context) {
    if (!context) return;
    const toolbar = ensureTaskToolbar(context);
    if (!toolbar) return;
    const state = getTaskState(context.config.endpoint);
    const values = {
      running: countRunningTasks(context, state),
      success: state.success,
      failed: state.failed,
    };
    Object.entries(values).forEach(([key, value]) => {
      const count = toolbar.querySelector(`[data-gala-task-stat="${key}"] b`);
      if (count) count.textContent = String(value);
    });
  }

  function markWorkspace(context) {
    context.root.classList.add("gala-page-root");
    context.root.dataset.galaPageRoot = context.config.key;
    context.workspace.classList.add("gala-two-pane-host");
    context.workspace.dataset.galaTwoPane = "true";

    if (context.input) {
      context.input.dataset.galaInputPanel = "true";
    }
    if (context.result) {
      context.result.dataset.galaResultPanel = "true";
    }
    if (context.queue) {
      context.queue.dataset.galaQueuePanel = "true";
    }
    markExactPanelHeading(context.root, "本次结果", "result");
    markExactPanelHeading(context.root, "归档与历史", "history");
    markExactPanelHeading(context.root, "01. 输入素材", "enhance-input");
    markExactPanelHeading(context.root, "02. 参数", "enhance-params");
    markExactPanelHeading(context.root, "01. 输入素材 / 相机控制", "angle-input");
    markExactPanelHeading(context.root, "02. 自定义提示词", "angle-prompt");
    markExactPanelHeading(context.root, "03. 参数", "angle-params");
  }

  function markExactPanelHeading(panel, label, key) {
    if (!panel) return;
    const candidates = Array.from(panel.querySelectorAll("h1, h2, h3, [role=heading], header, div, span"))
      .filter((element) => cleanText(element.textContent) === label)
      .sort((a, b) => {
        const rank = (element) => /H[1-3]/.test(element.tagName) ? 0 : element.tagName === "HEADER" ? 2 : 1;
        return rank(a) - rank(b) || a.children.length - b.children.length;
      });
    let heading = candidates[0];
    if (!heading) return;

    if (key === "history" && heading.tagName === "H2") {
      const replacement = document.createElement("div");
      Array.from(heading.attributes).forEach((attribute) => {
        replacement.setAttribute(attribute.name, attribute.value);
      });
      replacement.append(...Array.from(heading.childNodes).map((node) => node.cloneNode(true)));
      heading.replaceWith(replacement);
      heading = replacement;
    }

    heading.dataset.galaPanelHeading = key;
  }

  function findSectionHeading(section, matcher) {
    if (!section) return null;
    const headings = Array.from(section.querySelectorAll("h1, h2, h3, [role=heading]"));
    const direct = headings.find((element) => matcher.test(cleanText(element.textContent)));
    if (direct) return direct;

    const candidates = Array.from(section.querySelectorAll("p, div, span"))
      .filter((element) => !element.querySelector("button") && cleanText(element.textContent).length <= 60)
      .filter((element) => matcher.test(cleanText(element.textContent)))
      .sort((a, b) => cleanText(a.textContent).length - cleanText(b.textContent).length);
    return candidates[0] || null;
  }

  function setSectionHeading(section, matcher, label) {
    const heading = findSectionHeading(section, matcher);
    if (!heading) return;
    if (cleanText(heading.textContent) !== label) heading.textContent = label;
    heading.dataset.galaSectionLabel = label;
  }

  function findPromptSection(context, wrapper) {
    const scroll = context.inputScroll || context.input;
    if (!scroll) return null;
    return wrapper.closest("section") || scroll.querySelector("section") || scroll.firstElementChild;
  }

  function hideNativePromptActions(section) {
    if (!section) return;
    const actionButtons = Array.from(section.querySelectorAll("button")).filter((button) => {
      if (button.closest(".gala-prompt-tools")) return false;
      const label = cleanText(button.textContent);
      return label === "优化" || label === "翻译";
    });

    actionButtons.forEach((button) => {
      const action = cleanText(button.textContent) === "优化" ? "optimize" : "translate";
      button.dataset.galaNativeAction = action;
      const group = button.closest(".ml-auto") || button.parentElement;
      const hideTarget = group && group !== section && !group.querySelector(".prompt-variable-textarea") ? group : button;
      hideTarget.dataset.galaHiddenNativeAction = action;
      hideTarget.style.setProperty("display", "none", "important");
    });
  }

  function hideReferenceSections(context, sections) {
    if (!context.config.prompt) return;
    context.referenceInputs = [];

    sections.forEach((section) => {
      const text = cleanText(section.textContent).slice(0, 160);
      if (!context.config.hideReference.test(text)) return;

      context.referenceInputs.push(...Array.from(section.querySelectorAll("input[type=file]")));
      section.classList.add("gala-reference-hidden");
      section.dataset.galaReferenceHidden = "true";
      section.hidden = true;
    });
  }

  function getPromptEditor(context) {
    const scope = context.inputScroll || context.input;
    return scope && (
      scope.querySelector('.prompt-variable-textarea-editor[contenteditable="true"]') ||
      scope.querySelector('[contenteditable="true"][role="textbox"]') ||
      scope.querySelector("textarea.gala-angle-prompt-editor")
    );
  }

  function promptEditorForVariableButton(button) {
    if (!button) return null;
    const scope = button.closest(".online-prompt-editor-input, .prompt-variable-textarea, .gala-angle-prompt-composer, .prompt-editor");
    return scope && (
      scope.querySelector('.prompt-variable-textarea-editor[contenteditable="true"]') ||
      scope.querySelector('[contenteditable="true"][role="textbox"]') ||
      scope.querySelector("textarea.gala-angle-prompt-editor")
    );
  }

  function isRichPromptEditor(editor) {
    return Boolean(editor && (editor.isContentEditable || editor.getAttribute("contenteditable") === "true"));
  }

  function promptNodeInsideEditor(editor, node) {
    if (!editor || !node) return false;
    const element = node.nodeType === 1 ? node : node.parentElement;
    return Boolean(element && (element === editor || editor.contains(element)));
  }

  function promptSelection(editor) {
    if (!editor) return null;

    if (editor.tagName === "TEXTAREA") {
      const start = Number(editor.selectionStart);
      const end = Number(editor.selectionEnd);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return null;
      const rawText = String(editor.value || "").slice(start, end);
      const leading = rawText.match(/^\s*/)?.[0].length || 0;
      const trailing = rawText.match(/\s*$/)?.[0].length || 0;
      const text = rawText.slice(leading, rawText.length - trailing);
      if (!text || /[\r\n]/.test(text) || /[{}]/.test(text)) return null;
      return { text, start: start + leading, end: end - trailing };
    }

    if (!isRichPromptEditor(editor)) return null;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!promptNodeInsideEditor(editor, range.startContainer) || !promptNodeInsideEditor(editor, range.endContainer)) return null;

    const rawText = range.toString();
    const leading = rawText.match(/^\s*/)?.[0].length || 0;
    const trailing = rawText.match(/\s*$/)?.[0].length || 0;
    const text = rawText.slice(leading, rawText.length - trailing);
    if (!text || /[\r\n]/.test(text) || /[{}]/.test(text)) return null;

    try {
      const fragment = range.cloneContents();
      if (fragment.querySelector?.("[data-prompt-variable]")) return null;
    } catch (_error) {
      return null;
    }

    const startElement = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const endElement = range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement;
    if (startElement?.closest?.("[data-prompt-variable]") || endElement?.closest?.("[data-prompt-variable]")) return null;
    return { text };
  }

  function setVariableModeHint(button, active) {
    const row = button?.closest(".gala-prompt-tools-row, .gala-angle-prompt-tools, .prompt-tool-buttons");
    if (!row) return;

    let hint = row.querySelector(":scope > .gala-variable-mode-hint");
    if (!hint) {
      hint = document.createElement("span");
      hint.className = "gala-variable-mode-hint";
      hint.setAttribute("role", "status");
      hint.setAttribute("aria-live", "polite");
      row.appendChild(hint);
    }
    hint.textContent = active ? "请在提示词中划选要设为变量的文字" : "";
    hint.hidden = !active;
  }

  function setPromptVariableMode(button, active) {
    if (!button) return;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.title = active ? "取消变量选择" : "将选中文字设为变量";
    setVariableModeHint(button, active);
  }

  function findVisibleNativeVariablePopover() {
    return Array.from(document.querySelectorAll(".prompt-variable-selection-popover")).find((popover) => {
      if (popover.hidden) return false;
      const style = window.getComputedStyle(popover);
      return style.display !== "none" && style.visibility !== "hidden" && popover.getClientRects().length > 0;
    });
  }

  function triggerNativeVariablePopover(button, editor, attempt = 0) {
    if (!button?.isConnected || !editor?.isConnected) return;
    const popover = findVisibleNativeVariablePopover();
    if (popover) {
      delete button.dataset.galaVariableBusy;
      popover.click();
      setPromptVariableMode(button, false);
      return;
    }

    if (attempt >= 12) {
      delete button.dataset.galaVariableBusy;
      return;
    }

    button.dataset.galaVariableBusy = "true";
    window.setTimeout(() => triggerNativeVariablePopover(button, editor, attempt + 1), 30);
  }

  function updateTextareaPromptValue(editor, nextValue, cursorPosition) {
    editor.value = nextValue;
    try {
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: nextValue }));
    } catch (_error) {
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(cursorPosition, cursorPosition);
    window.requestAnimationFrame(() => {
      if (editor.isConnected) editor.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  function wrapTextareaPromptVariable(editor, selection) {
    if (!editor || !selection || editor.tagName !== "TEXTAREA") return false;
    const value = String(editor.value || "");
    const nextValue = `${value.slice(0, selection.start)}{{${selection.text}}}${value.slice(selection.end)}`;
    updateTextareaPromptValue(editor, nextValue, selection.start + selection.text.length + 4);
    return true;
  }

  function togglePromptVariableMode(button) {
    const editor = promptEditorForVariableButton(button);
    if (!editor) return;

    if (button.getAttribute("aria-pressed") === "true") {
      setPromptVariableMode(button, false);
      editor.focus({ preventScroll: true });
      return;
    }

    const selection = promptSelection(editor);
    if (selection && editor.tagName === "TEXTAREA") {
      if (wrapTextareaPromptVariable(editor, selection)) setPromptVariableMode(button, false);
      return;
    }

    setPromptVariableMode(button, true);
    editor.focus({ preventScroll: true });
    if (selection && isRichPromptEditor(editor)) triggerNativeVariablePopover(button, editor);
  }

  function checkPromptVariableSelection() {
    if (variableSelectionPointerDown) return;
    const buttons = Array.from(document.querySelectorAll('[data-gala-prompt-action="variable"][aria-pressed="true"]'));
    buttons.forEach((button) => {
      if (button.dataset.galaVariableBusy === "true") return;
      const editor = promptEditorForVariableButton(button);
      const selection = promptSelection(editor);
      if (!editor || !selection) return;

      if (editor.tagName === "TEXTAREA") {
        if (wrapTextareaPromptVariable(editor, selection)) setPromptVariableMode(button, false);
        return;
      }

      if (isRichPromptEditor(editor)) triggerNativeVariablePopover(button, editor);
    });
  }

  function schedulePromptVariableSelectionCheck() {
    if (variableSelectionFrame) return;
    variableSelectionFrame = window.requestAnimationFrame(() => {
      variableSelectionFrame = 0;
      checkPromptVariableSelection();
    });
  }

  function handlePromptVariablePointerDown(event) {
    const button = document.querySelector('[data-gala-prompt-action="variable"][aria-pressed="true"]');
    const editor = promptEditorForVariableButton(button);
    if (editor && (event.target === editor || editor.contains(event.target))) variableSelectionPointerDown = true;
  }

  function handlePromptVariablePointerUp() {
    if (!variableSelectionPointerDown) return;
    variableSelectionPointerDown = false;
    schedulePromptVariableSelectionCheck();
  }

  function handlePromptVariablePointerCancel() {
    variableSelectionPointerDown = false;
  }

  function cancelPromptVariableModes() {
    let canceled = false;
    document.querySelectorAll('[data-gala-prompt-action="variable"][aria-pressed="true"]').forEach((button) => {
      setPromptVariableMode(button, false);
      delete button.dataset.galaVariableBusy;
      canceled = true;
    });
    return canceled;
  }

  function schedulePromptResize(context, editor) {
    window.requestAnimationFrame(() => resizePrompt(context, editor));
  }

  function measurePromptContentHeight(editor) {
    if (!editor || !cleanText(editor.innerText || editor.textContent)) return 0;
    const measure = editor.cloneNode(true);
    const width = Math.max(120, Math.floor(editor.getBoundingClientRect().width || 320));
    measure.setAttribute("aria-hidden", "true");
    measure.style.setProperty("box-sizing", "border-box", "important");
    measure.style.setProperty("display", "block", "important");
    measure.style.setProperty("flex", "none", "important");
    measure.style.setProperty("height", "auto", "important");
    measure.style.setProperty("left", "-100000px", "important");
    measure.style.setProperty("max-height", "none", "important");
    measure.style.setProperty("min-height", "0", "important");
    measure.style.setProperty("overflow", "visible", "important");
    measure.style.setProperty("position", "absolute", "important");
    measure.style.setProperty("top", "0", "important");
    measure.style.setProperty("visibility", "hidden", "important");
    measure.style.setProperty("width", `${width}px`, "important");
    document.body.appendChild(measure);
    const height = Math.max(32, measure.scrollHeight || measure.getBoundingClientRect().height || 0);
    measure.remove();
    return height;
  }

  function resizePrompt(context, editor) {
    if (!context || !context.input || !editor || !editor.isConnected) return;
    const wrapper = editor.closest(".online-prompt-editor-input") || editor.closest(".prompt-variable-textarea");
    const surface = wrapper && wrapper.querySelector(".prompt-variable-textarea-surface");
    if (!wrapper || !surface) return;

    const panelHeight = context.input.getBoundingClientRect().height || 620;
    const baseHeight = window.innerWidth <= 640 ? 220 : 230;
    const maxHeight = Math.max(baseHeight, Math.floor(panelHeight * 0.5));
    editor.style.setProperty("height", "auto", "important");
    editor.style.setProperty("max-height", "none", "important");

    const attachmentStrip = wrapper.querySelector(":scope > .gala-prompt-tools .gala-attachment-strip");
    const attachmentHeight = attachmentStrip && !attachmentStrip.hidden ? Math.max(56, attachmentStrip.scrollHeight || 0) : 0;
    const contentHeight = measurePromptContentHeight(editor);
    const desiredHeight = Math.max(baseHeight, contentHeight + attachmentHeight + 66);
    const nextHeight = Math.min(maxHeight, desiredHeight);
    const needsScroll = desiredHeight > maxHeight + 2;

    surface.style.setProperty("height", "auto", "important");
    surface.style.setProperty("min-height", "0", "important");
    surface.style.setProperty("overflow-y", "hidden", "important");
    editor.style.setProperty("overflow-y", needsScroll ? "auto" : "hidden", "important");
    wrapper.style.setProperty("height", `${nextHeight}px`, "important");
    wrapper.style.setProperty("min-height", `${nextHeight}px`, "important");
  }

  function bindPromptResize(context, editor) {
    if (!editor || editor.dataset.galaResizeBound) {
      schedulePromptResize(context, editor);
      return;
    }
    editor.dataset.galaResizeBound = "true";
    const resize = () => schedulePromptResize(context, editor);
    editor.addEventListener("input", resize);
    editor.addEventListener("keyup", resize);
    editor.addEventListener("focus", resize);
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(resize);
      observer.observe(editor);
    }
    schedulePromptResize(context, editor);
  }

  function bindTypedMentionTrigger(context, editor, anchor) {
    if (!editor || !context || !context.config.prompt || editor.dataset.galaMentionTriggerBound) return;
    editor.dataset.galaMentionTriggerBound = "true";
    const checkMentionTrigger = () => {
      window.requestAnimationFrame(() => {
        const currentContext = findPageContext() || context;
        if (currentContext.config.key !== context.config.key) return;
        if (mentionPopover || editor.dataset.galaMentionButtonInsert === "true") return;
        const currentEditor = getPromptEditor(currentContext);
        if (!currentEditor || !promptText(currentEditor).endsWith("@")) return;
        openMentionPopover(currentContext, anchor);
      });
    };
    editor.addEventListener("input", checkMentionTrigger);
    editor.addEventListener("keyup", checkMentionTrigger);
  }

  function getAttachmentList(key) {
    if (!attachmentStates.has(key)) attachmentStates.set(key, []);
    return attachmentStates.get(key);
  }

  function attachmentKey(file) {
    return `${file.name}|${file.size}|${file.lastModified}`;
  }

  function attachmentReviewKey(scope, file) {
    return `${scope}:${attachmentKey(file)}`;
  }

  function getAttachmentReviewState(scope, file) {
    return attachmentReviewStates.get(attachmentReviewKey(scope, file)) || null;
  }

  function showAttachmentReviewToast(message, tone = "info") {
    let toast = document.querySelector("[data-gala-asset-review-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.dataset.galaAssetReviewToast = "true";
      document.body.appendChild(toast);
    }
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    let icon = toast.querySelector("[data-gala-toast-icon]");
    if (!icon) {
      icon = document.createElement("span");
      icon.dataset.galaToastIcon = "true";
      icon.setAttribute("aria-hidden", "true");
      toast.prepend(icon);
    }
    icon.className = `gala-toast-icon gala-toast-icon--${tone}`;
    icon.textContent = tone === "success" ? "✓" : tone === "failed" ? "!" : "";
    let copy = toast.querySelector("[data-gala-toast-copy]");
    if (!copy) {
      copy = document.createElement("span");
      copy.dataset.galaToastCopy = "true";
      toast.appendChild(copy);
    }
    toast.querySelector("[data-gala-toast-action]")?.remove();
    toast.className = `gala-asset-review-toast gala-asset-review-toast--${tone}`;
    copy.textContent = message;
    if (attachmentToastTimer) window.clearTimeout(attachmentToastTimer);
    attachmentToastTimer = window.setTimeout(() => {
      toast.classList.add("is-hiding");
      window.setTimeout(() => toast.isConnected && toast.remove(), 180);
    }, 2600);
  }

  function closeVolcLibraryModal() {
    if (!volcLibraryModal?.backdrop) return;
    volcLibraryModal.backdrop.hidden = true;
    document.body.classList.remove("gala-volc-library-open");
    volcLibraryTarget = null;
  }

  function closePromptAttachmentSourceMenu() {
    if (!promptAttachmentSourceMenu?.node) return;
    promptAttachmentSourceMenu.node.remove();
    promptAttachmentSourceMenu = null;
  }

  function openPromptAttachmentSourceMenu(anchor, context, fileInput) {
    if (!anchor || !context || !fileInput) return;
    if (promptAttachmentSourceMenu?.anchor === anchor) {
      closePromptAttachmentSourceMenu();
      return;
    }
    closePromptAttachmentSourceMenu();

    const node = document.createElement("div");
    node.className = "gala-prompt-attachment-source-menu";
    node.setAttribute("role", "menu");
    node.setAttribute("aria-label", "选择素材来源");
    node.innerHTML = `
      <div class="gala-prompt-attachment-source-heading">添加素材</div>
      <button type="button" role="menuitem" data-gala-attachment-source="local">
        <span class="gala-prompt-attachment-source-icon is-upload" aria-hidden="true"></span>
        <span><strong>本地上传</strong><small>从电脑选择文件</small></span>
      </button>
      <button type="button" role="menuitem" data-gala-attachment-source="volc">
        <span class="gala-prompt-attachment-source-icon is-library" aria-hidden="true"></span>
        <span><strong>素材库</strong><small>火山版权报备素材</small></span>
      </button>
    `;

    const local = node.querySelector('[data-gala-attachment-source="local"]');
    const volc = node.querySelector('[data-gala-attachment-source="volc"]');
    local?.addEventListener("click", () => {
      closePromptAttachmentSourceMenu();
      fileInput.click();
    });
    volc?.addEventListener("click", () => {
      closePromptAttachmentSourceMenu();
      openVolcLibraryModal({ kind: "online", context });
    });

    document.body.appendChild(node);
    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = node.getBoundingClientRect();
    const left = Math.max(12, Math.min(anchorRect.left, window.innerWidth - menuRect.width - 12));
    const top = anchorRect.top - menuRect.height - 8 >= 12
      ? anchorRect.top - menuRect.height - 8
      : Math.min(window.innerHeight - menuRect.height - 12, anchorRect.bottom + 8);
    node.style.left = `${left}px`;
    node.style.top = `${Math.max(12, top)}px`;
    promptAttachmentSourceMenu = { anchor, node };
  }

  function volcLibraryAssetKind(file) {
    return String(file?.type || "").startsWith("video/") ? "video" : "image";
  }

  function volcLibraryAssetStatusLabel(status) {
    return status === "approved" ? "审核通过" : status === "pending" ? "审核中" : "审核失败";
  }

  function attachVolcLibraryAssetToOnline(asset, target = volcLibraryTarget) {
    if (!asset?.file || target?.kind !== "online") return false;
    const context = target.context || findPageContext();
    if (!context) return false;
    const list = getAttachmentList(context.config.key);
    if (!list.some((existing) => attachmentKey(existing) === attachmentKey(asset.file))) {
      list.push(asset.file);
    }
    const tools = context.input?.querySelector(".gala-prompt-tools");
    const strip = tools?.querySelector(".gala-attachment-strip");
    const phase = asset.status === "approved" ? "success" : asset.status === "failed" ? "failed" : "reviewing";
    attachmentReviewStates.set(attachmentReviewKey(context.config.key, asset.file), {
      phase,
      provider: "volcengine",
    });
    syncReferenceInputs(context, [asset.file]);
    renderAttachments(context, strip);
    schedulePromptResize(context, getPromptEditor(context));
    return true;
  }

  function selectVolcLibraryAsset(asset) {
    if (!asset?.file || asset.status !== "approved") return;
    const target = volcLibraryTarget;
    closeVolcLibraryModal();
    if (target?.kind === "online") {
      if (attachVolcLibraryAssetToOnline(asset, target)) {
        showAttachmentReviewToast("素材已添加到输入框", "success");
      }
      return;
    }
    if (target?.kind === "canvas") {
      startCanvasPrototypeUpload([asset.file], target.nodeId || "");
    }
  }

  function renderVolcLibraryModal() {
    if (!volcLibraryModal) return;
    const { grid, filter } = volcLibraryModal;
    grid.replaceChildren();

    const upload = document.createElement("button");
    upload.type = "button";
    upload.className = "gala-volc-library-upload";
    upload.innerHTML = '<span class="gala-volc-library-upload-icon">+</span><strong>上传素材</strong><small>图片 / 视频</small>';
    upload.addEventListener("click", () => volcLibraryModal.input.click());
    grid.appendChild(upload);

    const assets = volcLibraryAssets.filter((asset) => filter === "all" || asset.kind === filter);
    assets.forEach((asset) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `gala-volc-library-card is-${asset.status}`;
      card.disabled = asset.status !== "approved" || !asset.file;
      card.title = card.disabled ? volcLibraryAssetStatusLabel(asset.status) : "选择此素材";

      const preview = document.createElement("span");
      preview.className = "gala-volc-library-card-preview";
      if (asset.file && asset.file.type?.startsWith("image/") && window.URL?.createObjectURL) {
        let url = volcLibraryPreviewUrls.get(asset.id);
        if (!url) {
          url = URL.createObjectURL(asset.file);
          volcLibraryPreviewUrls.set(asset.id, url);
        }
        const image = document.createElement("img");
        image.src = url;
        image.alt = "";
        preview.appendChild(image);
      } else {
        const kind = document.createElement("span");
        kind.className = "gala-volc-library-card-kind";
        kind.textContent = asset.kind === "video" ? "视频" : "图片";
        preview.appendChild(kind);
      }

      const copy = document.createElement("span");
      copy.className = "gala-volc-library-card-copy";
      const name = document.createElement("strong");
      name.textContent = asset.name;
      const meta = document.createElement("small");
      meta.textContent = volcLibraryAssetStatusLabel(asset.status);
      copy.append(name, meta);
      card.append(preview, copy);

      const status = document.createElement("span");
      status.className = "gala-volc-library-card-status";
      status.textContent = volcLibraryAssetStatusLabel(asset.status);
      card.appendChild(status);
      if (asset.status === "approved") {
        card.addEventListener("click", () => selectVolcLibraryAsset(asset));
      }
      grid.appendChild(card);
    });

    if (!assets.length) {
      const empty = document.createElement("div");
      empty.className = "gala-volc-library-empty";
      empty.textContent = "暂无已审核素材，可上传需要火山版权报备的素材";
      grid.appendChild(empty);
    }
  }

  function ensureVolcLibraryModal() {
    if (volcLibraryModal?.backdrop?.isConnected) return volcLibraryModal;
    const backdrop = document.createElement("div");
    backdrop.className = "gala-volc-library-backdrop";
    backdrop.hidden = true;
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeVolcLibraryModal();
    });

    const dialog = document.createElement("section");
    dialog.className = "gala-volc-library-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "火山素材库");

    const header = document.createElement("header");
    header.className = "gala-volc-library-header";
    const heading = document.createElement("div");
    heading.className = "gala-volc-library-heading";
    const title = document.createElement("strong");
    title.textContent = "素材库";
    const hint = document.createElement("span");
    hint.textContent = "火山版权报备素材，审核通过后可直接使用";
    heading.append(title, hint);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "gala-volc-library-close";
    close.setAttribute("aria-label", "关闭素材库");
    close.textContent = "×";
    close.addEventListener("click", closeVolcLibraryModal);
    header.append(heading, close);

    const toolbar = document.createElement("div");
    toolbar.className = "gala-volc-library-toolbar";
    const tabs = document.createElement("div");
    tabs.className = "gala-volc-library-tabs";
    [
      ["all", "全部"],
      ["image", "图片"],
      ["video", "视频"],
    ].forEach(([value, label]) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.dataset.galaVolcLibraryFilter = value;
      tab.textContent = label;
      tab.addEventListener("click", () => {
        volcLibraryModal.filter = value;
        tabs.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === tab));
        renderVolcLibraryModal();
      });
      tabs.appendChild(tab);
    });
    toolbar.appendChild(tabs);

    const grid = document.createElement("div");
    grid.className = "gala-volc-library-grid";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.hidden = true;
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      const target = volcLibraryTarget;
      const asset = {
        id: `gala-volc-asset-${Date.now()}-${++volcLibraryAssetSequence}`,
        file,
        kind: volcLibraryAssetKind(file),
        name: file.name || "未命名素材",
        status: "pending",
      };
      volcLibraryAssets.unshift(asset);
      const attached = target?.kind === "online"
        && attachVolcLibraryAssetToOnline(asset, target);
      if (attached) {
        asset.onlineTarget = target;
        showAttachmentReviewToast("素材已添加到输入框，审核中", "reviewing");
      } else {
        renderVolcLibraryModal();
      }
      window.setTimeout(() => {
        asset.status = "approved";
        if (asset.onlineTarget) attachVolcLibraryAssetToOnline(asset, asset.onlineTarget);
        if (volcLibraryModal && !volcLibraryModal.backdrop.hidden) renderVolcLibraryModal();
      }, 1600);
      input.value = "";
    });

    dialog.append(header, toolbar, grid, input);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    volcLibraryModal = { backdrop, dialog, grid, input, filter: "all" };
    const firstTab = tabs.querySelector("button");
    firstTab?.classList.add("is-active");
    return volcLibraryModal;
  }

  function openVolcLibraryModal(target = {}) {
    const modal = ensureVolcLibraryModal();
    volcLibraryTarget = target;
    modal.filter = "all";
    modal.backdrop.hidden = false;
    document.body.classList.add("gala-volc-library-open");
    modal.dialog.querySelectorAll(".gala-volc-library-tabs button").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.galaVolcLibraryFilter === "all");
    });
    renderVolcLibraryModal();
  }

  function startAttachmentUpload(context, files, strip) {
    if (!context || !files?.length) return;
    const scope = context.config.key;
    const uniqueFiles = files.filter((file, index, list) => (
      list.findIndex((item) => attachmentKey(item) === attachmentKey(file)) === index
    ));
    uniqueFiles.forEach((file) => {
      attachmentReviewStates.set(attachmentReviewKey(scope, file), { phase: "uploading", provider: "" });
    });
    renderAttachments(context, strip);
    showAttachmentReviewToast("素材上传中…", "uploading");
    window.setTimeout(() => {
      const activeKeys = new Set(getAttachmentList(scope).map(attachmentKey));
      uniqueFiles.forEach((file) => {
        if (activeKeys.has(attachmentKey(file))) {
          attachmentReviewStates.set(attachmentReviewKey(scope, file), { phase: "success", provider: "" });
        }
      });
      renderAttachments(context, strip);
    }, 900);
  }

  function startAttachmentReview(context, files, strip) {
    if (!context || !files?.length) return;
    const scope = context.config.key;
    const providerReview = isVolcProviderReviewContext(context);
    const provider = providerReview ? "volcengine" : "";
    const uniqueFiles = files.filter((file, index, list) => (
      list.findIndex((item) => attachmentKey(item) === attachmentKey(file)) === index
    ));
    uniqueFiles.forEach((file) => {
      attachmentReviewStates.set(attachmentReviewKey(scope, file), { phase: "uploading", provider });
    });
    renderAttachments(context, strip);
    showAttachmentReviewToast("素材上传中…", "uploading");

    window.setTimeout(() => {
      const activeKeys = new Set(getAttachmentList(scope).map(attachmentKey));
      uniqueFiles.forEach((file) => {
        if (activeKeys.has(attachmentKey(file))) {
          attachmentReviewStates.set(attachmentReviewKey(scope, file), { phase: "reviewing", provider });
        }
      });
      renderAttachments(context, strip);
      showAttachmentReviewToast(
        providerReview ? "素材已上传，正在检查火山模型可用性" : "素材已上传，正在审核",
        "reviewing",
      );
    }, 1200);
    scheduleAttachmentReviewOutcome(context, scope, uniqueFiles, strip);
  }

  function chooseAttachmentReviewOutcome() {
    let outcome = Math.random() < 0.65 ? "success" : "failed";
    if (attachmentReviewSameOutcomeCount >= 2 && attachmentReviewLastOutcome) {
      outcome = attachmentReviewLastOutcome === "success" ? "failed" : "success";
    }
    if (outcome === attachmentReviewLastOutcome) {
      attachmentReviewSameOutcomeCount += 1;
    } else {
      attachmentReviewLastOutcome = outcome;
      attachmentReviewSameOutcomeCount = 1;
    }
    return outcome;
  }

  function scheduleAttachmentReviewOutcome(context, scope, files, strip) {
    const providerReview = isVolcProviderReviewContext(context);
    const provider = providerReview ? "volcengine" : "";
    const outcomes = files.map(() => chooseAttachmentReviewOutcome());
    if (outcomes.length > 1 && outcomes.every((outcome) => outcome === outcomes[0])) {
      outcomes[outcomes.length - 1] = outcomes[0] === "success" ? "failed" : "success";
    }
    window.setTimeout(() => {
      const activeKeys = new Set(getAttachmentList(scope).map(attachmentKey));
      let successCount = 0;
      let failedCount = 0;
      files.forEach((file, index) => {
        if (!activeKeys.has(attachmentKey(file))) return;
        const phase = outcomes[index];
        attachmentReviewStates.set(attachmentReviewKey(scope, file), { phase, provider });
        if (phase === "success") successCount += 1;
        if (phase === "failed") failedCount += 1;
      });
      renderAttachments(context, strip);
      if (providerReview) {
        if (failedCount) {
          const message = successCount
            ? `火山模型可用性已更新：${failedCount} 个素材不可用于火山模型，其他模型仍可使用`
            : `火山模型不可用：${failedCount} 个素材仍可用于其他模型`;
          showAttachmentReviewToast(message, "provider");
        } else if (successCount) {
          showAttachmentReviewToast("火山模型可用性检查完成", "provider");
        }
        return;
      }
      if (successCount && failedCount) {
        showAttachmentReviewToast(
          `\u5ba1\u6838\u5b8c\u6210\uff1a\u6210\u529f ${successCount} \u4e2a\uff0c\u5931\u8d25 ${failedCount} \u4e2a`,
          "failed",
        );
      } else if (failedCount) {
        showAttachmentReviewToast(`\u7d20\u6750\u5ba1\u6838\u5931\u8d25\uff1a${failedCount} \u4e2a`, "failed");
      } else if (successCount) {
        showAttachmentReviewToast(`\u7d20\u6750\u5ba1\u6838\u6210\u529f\uff1a${successCount} \u4e2a`, "success");
      }
    }, 2200 + Math.floor(Math.random() * 1800));
  }

  function fileExtension(file) {
    const name = String(file && file.name || "");
    const dot = name.lastIndexOf(".");
    return dot > -1 ? name.slice(dot + 1).toUpperCase() : "文件";
  }

  function attachmentPreview(file) {
    const key = attachmentKey(file);
    if (file && file.type && file.type.startsWith("image/") && window.URL && URL.createObjectURL) {
      let url = attachmentPreviewUrls.get(key);
      if (!url) {
        url = URL.createObjectURL(file);
        attachmentPreviewUrls.set(key, url);
      }
      const image = document.createElement("img");
      image.className = "gala-attachment-preview-image";
      image.alt = "";
      image.src = url;
      return image;
    }

    const icon = document.createElement("span");
    icon.className = "gala-attachment-preview-icon";
    icon.textContent = fileExtension(file);
    return icon;
  }

  function renderAttachments(context, strip) {
    const target = strip || (context.input && context.input.querySelector(".gala-attachment-strip"));
    if (!target) return;
    const files = getAttachmentList(context.config.key);
    const activeKeys = new Set(files.map(attachmentKey));
    attachmentPreviewUrls.forEach((url, key) => {
      if (!activeKeys.has(key)) {
        URL.revokeObjectURL(url);
        attachmentPreviewUrls.delete(key);
      }
    });
    target.replaceChildren();
    target.hidden = files.length === 0;

    files.forEach((file, index) => {
      const chip = document.createElement("div");
      chip.className = "gala-attachment-chip";
      chip.title = file.name;
      const reviewState = getAttachmentReviewState(context.config.key, file);
      if (reviewState?.phase) chip.dataset.galaAttachmentStatus = reviewState.phase;
      if (reviewState?.provider) chip.dataset.galaAttachmentProvider = reviewState.provider;
      if (reviewState?.phase === "failed" && reviewState.provider === "volcengine") {
        chip.dataset.galaAttachmentProviderStatus = "rejected";
        chip.title = `${file.name} · 火山素材库审核未通过，其他模型仍可使用`;
      } else if (reviewState?.phase === "reviewing") {
        chip.dataset.galaAttachmentProviderStatus = "pending";
      }

      const preview = document.createElement("span");
      preview.className = "gala-attachment-preview";
      preview.appendChild(attachmentPreview(file));
      if (reviewState?.phase === "uploading") {
        const overlay = document.createElement("span");
        overlay.className = "gala-attachment-status-overlay";
        const spinner = document.createElement("span");
        spinner.className = "gala-attachment-status-spinner";
        const label = document.createElement("span");
        label.className = "gala-attachment-status-label";
        label.textContent = "上传中";
        overlay.append(spinner, label);
        preview.appendChild(overlay);
      }
      chip.appendChild(preview);

      const copy = document.createElement("span");
      copy.className = "gala-attachment-copy";

      const name = document.createElement("span");
      name.className = "gala-attachment-name";
      name.textContent = file.name;
      copy.appendChild(name);

      const type = document.createElement("span");
      type.className = "gala-attachment-type";
      type.textContent = fileExtension(file);
      copy.appendChild(type);
      if (reviewState?.phase === "reviewing") {
        const review = document.createElement("span");
        review.className = "gala-attachment-provider-status is-pending";
        review.textContent = "审核中";
        copy.appendChild(review);
      }
      if (reviewState?.phase === "failed" && reviewState.provider === "volcengine") {
        const providerStatus = document.createElement("span");
        providerStatus.className = "gala-attachment-provider-status is-rejected";
        providerStatus.title = "火山素材库审核未通过，其他模型仍可使用";
        const statusLabel = document.createElement("span");
        statusLabel.textContent = "审核失败";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "gala-attachment-provider-retry";
        retry.textContent = "重试";
        retry.setAttribute("aria-label", `重试火山素材库审核：${file.name}`);
        retry.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          startAttachmentReview(context, [file], target);
        });
        providerStatus.append(statusLabel, retry);
        copy.appendChild(providerStatus);
      }
      if (reviewState?.phase === "success" && reviewState.provider === "volcengine") {
        chip.dataset.galaAttachmentProviderStatus = "passed";
        const providerStatus = document.createElement("span");
        providerStatus.className = "gala-attachment-provider-status is-passed";
        providerStatus.textContent = "审核通过";
        copy.appendChild(providerStatus);
      }
      chip.appendChild(copy);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "gala-attachment-remove";
      remove.setAttribute("aria-label", `移除附件 ${file.name}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        const list = getAttachmentList(context.config.key);
        list.splice(index, 1);
        attachmentReviewStates.delete(attachmentReviewKey(context.config.key, file));
        renderAttachments(context, target);
        schedulePromptResize(context, getPromptEditor(context));
      });
      chip.appendChild(remove);
      target.appendChild(chip);
    });
    renderVolcProviderAvailabilityNotice(context, target);
    renderWan30PromptSummary(context, target.closest(".gala-prompt-tools"));
  }

  function renderVolcProviderAvailabilityNotice(context, strip) {
    const tools = strip?.closest(".gala-prompt-tools");
    if (!tools) return;

    let notice = tools.querySelector("[data-gala-provider-availability-notice]");
    const files = getAttachmentList(context.config.key);
    const states = files.map((file) => getAttachmentReviewState(context.config.key, file));
    const rejected = states.filter((state) => state?.provider === "volcengine" && state.phase === "failed").length;
    const pending = states.filter((state) => state?.provider === "volcengine" && state.phase === "reviewing").length;
    const shouldShow = isVolcProviderReviewContext(context)
      && isVolcModelScope(context.inputScroll || context.input)
      && (rejected || pending);

    if (!shouldShow) {
      notice?.remove();
      return;
    }
    if (!notice) {
      notice = document.createElement("div");
      notice.dataset.galaProviderAvailabilityNotice = "true";
      notice.setAttribute("role", "status");
      notice.setAttribute("aria-live", "polite");
      tools.appendChild(notice);
    }
    notice.className = `gala-provider-availability-notice ${rejected ? "is-blocked" : "is-pending"}`;
    notice.textContent = rejected
      ? `当前火山模型不可用：${rejected} 个素材不符合火山素材库要求，其他模型仍可使用`
      : `正在检查 ${pending} 个素材的火山模型可用性`;
  }

  function renderWan30PromptSummary(context, tools) {
    if (!tools) return;
    const summary = tools.querySelector(".gala-wan30-input-summary");
    if (!summary) return;
    if (!isWan30VideoContext(context)) {
      summary.hidden = true;
      return;
    }

    const files = getAttachmentList(context.config.key);
    const url = getWan30UrlState(context.config.key).value;
    summary.hidden = false;
    summary.dataset.hasValue = files.length || url ? "true" : "false";
    summary.replaceChildren();

    const label = document.createElement("span");
    label.className = "gala-wan30-input-summary-label";
    label.textContent = "wan3.0 输入";
    summary.appendChild(label);

    const fileCount = document.createElement("span");
    fileCount.className = "gala-wan30-input-summary-count";
    fileCount.textContent = `文件 ${Math.min(files.length, 1)}/1`;
    summary.appendChild(fileCount);

    const urlCount = document.createElement("span");
    urlCount.className = "gala-wan30-input-summary-count";
    urlCount.textContent = `URL ${url ? 1 : 0}/1`;
    summary.appendChild(urlCount);

    if (url) {
      const chip = document.createElement("span");
      chip.className = "gala-wan30-url-chip";
      chip.title = url;
      const text = document.createElement("span");
      text.textContent = url;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "gala-wan30-url-chip-remove";
      remove.setAttribute("aria-label", "移除 URL");
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        getWan30UrlState(context.config.key).value = "";
        renderWan30PromptSummary(context, tools);
      });
      chip.append(text, remove);
      summary.appendChild(chip);
    }

    const notice = cleanText(tools.dataset.galaWan30Notice);
    if (notice) {
      const message = document.createElement("span");
      message.className = "gala-wan30-input-summary-notice";
      message.setAttribute("role", "status");
      message.textContent = notice;
      summary.appendChild(message);
    }
  }

  function syncReferenceInputs(context, files) {
    const inputs = (context.referenceInputs || []).filter((input) => input && input.isConnected);
    if (!inputs.length || !window.DataTransfer) return;

    files.slice(0, inputs.length).forEach((file, index) => {
      try {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        inputs[index].files = transfer.files;
        inputs[index].dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_error) {
        // Some browsers expose the file input as read-only. The visible
        // attachment strip still remains usable in that case.
      }
    });
  }

  function insertEditorText(editor, value) {
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, value);
    } catch (_error) {
      inserted = false;
    }

    if (!inserted) {
      range.insertNode(document.createTextNode(value));
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    try {
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    } catch (_error) {
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
    schedulePromptResize(findPageContext(), editor);
  }

  function replaceTrailingMentionTrigger(editor, value) {
    if (!editor) return;
    editor.focus();

    const walker = document.createTreeWalker(editor, 4);
    let lastTextNode = null;
    let currentNode = walker.nextNode();
    while (currentNode) {
      lastTextNode = currentNode;
      currentNode = walker.nextNode();
    }

    if (lastTextNode && String(lastTextNode.textContent || "").endsWith("@")) {
      const range = document.createRange();
      const end = lastTextNode.textContent.length;
      range.setStart(lastTextNode, end - 1);
      range.setEnd(lastTextNode, end);
      range.deleteContents();
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    insertEditorText(editor, value);
  }

  function findNativePromptAction(context, type) {
    const wrapper = context.promptWrapper;
    const section = context.promptSection;
    const scope = section || wrapper || context.input;
    if (!scope) return null;
    return Array.from(scope.querySelectorAll("button")).find((button) => {
      if (button.closest(".gala-prompt-tools")) return false;
      if (button.dataset.galaNativeAction === type) return true;
      const label = cleanText(button.textContent);
      return (type === "optimize" && label === "优化") || (type === "translate" && label === "翻译");
    });
  }

  function promptText(editor) {
    if (!editor) return "";
    const isRichEditor = editor.isContentEditable || editor.getAttribute("contenteditable") === "true";
    const value = isRichEditor
      ? editor.innerText || editor.textContent
      : editor.value !== undefined
        ? editor.value
        : editor.innerText || editor.textContent;
    return cleanText(value);
  }

  function detectPromptLanguage(value) {
    const chinese = (String(value || "").match(/[\u3400-\u9fff]/g) || []).length;
    const latin = (String(value || "").match(/[A-Za-z]/g) || []).length;
    return latin > chinese ? "en-zh" : "zh-en";
  }

  function promptAssistTitle(action) {
    return action === "translate" ? "翻译提示词" : "优化提示词";
  }

  function findPromptAssistPanel(action) {
    const actionLabel = action === "translate" ? "翻译" : "优化";
    const textareas = Array.from(document.querySelectorAll("textarea"))
      .filter((textarea) => !textarea.closest(".gala-task-modal") && !textarea.closest(".gala-prompt-tools"));
    const candidates = [];

    textareas.forEach((textarea) => {
      let panel = textarea.parentElement;
      while (panel && panel !== document.body) {
        const text = cleanText(panel.textContent);
        const buttons = Array.from(panel.querySelectorAll("button"));
        if (buttons.length >= 2 && text.includes(actionLabel)) {
          candidates.push(panel);
          break;
        }
        panel = panel.parentElement;
      }
    });

    return candidates
      .sort((a, b) => (a.getBoundingClientRect().height || 0) - (b.getBoundingClientRect().height || 0))[0] || null;
  }

  function waitForPromptAssistPanel(action, timeout = 1200) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const check = () => {
        const panel = findPromptAssistPanel(action);
        if (panel) {
          resolve(panel);
          return;
        }
        if (Date.now() - startedAt >= timeout) {
          resolve(null);
          return;
        }
        window.setTimeout(check, 24);
      };
      check();
    });
  }

  function hidePromptAssistPanel(panel) {
    if (!panel) return;
    panel.classList.add("gala-prompt-assist-hidden");
  }

  async function runPromptAssist(context, action, trigger) {
    if (!context || !trigger || trigger.dataset.galaBusy === "true") return;
    const editor = getPromptEditor(context);
    const value = promptText(editor);
    if (!value) {
      editor && editor.focus();
      return;
    }

    const nativeButton = findNativePromptAction(context, action);
    if (!nativeButton) return;

    trigger.dataset.galaBusy = "true";
    trigger.disabled = true;
    trigger.setAttribute("aria-busy", "true");
    nativeButton.click();

    const panel = await waitForPromptAssistPanel(action);
    if (panel) {
      hidePromptAssistPanel(panel);

      if (action === "translate") {
        const direction = detectPromptLanguage(value);
        const directionLabel = direction === "en-zh" ? "英译中" : "中译英";
        const directionButton = Array.from(panel.querySelectorAll("button"))
          .find((button) => cleanText(button.textContent) === directionLabel);
        if (directionButton) directionButton.click();
      }

      const actionLabel = action === "translate" ? "翻译" : "优化";
      const runButton = Array.from(panel.querySelectorAll("button"))
        .find((button) => cleanText(button.textContent) === actionLabel);
      if (runButton) {
        runButton.click();
        window.setTimeout(() => hidePromptAssistPanel(panel), 0);
      }
    } else {
      // Keep the custom toolbar authoritative even if the native assist UI
      // is unavailable or takes too long to mount.
      hidePromptAssistOverlays();
    }

    window.setTimeout(() => {
      trigger.disabled = false;
      trigger.removeAttribute("aria-busy");
      delete trigger.dataset.galaBusy;
      hidePromptAssistOverlays();
    }, panel ? 900 : 0);
  }

  function hidePromptAssistOverlays() {
    ["optimize", "translate"].forEach((action) => hidePromptAssistPanel(findPromptAssistPanel(action)));
  }

  function collectMentionItems(context) {
    return getAttachmentList(context.config.key).map((file, index) => {
      const kind = file.type && file.type.startsWith("video") ? "video" : file.type && file.type.startsWith("image") ? "image" : "file";
      const prefix = kind === "video" ? "视频" : kind === "image" ? "图" : "素材";
      const extension = fileExtension(file).toLowerCase();
      return {
        file,
        kind,
        label: `${prefix}${index + 1}.${extension === "文件" ? "bin" : extension}`,
        meta: file.name,
      };
    });
  }

  function closeMentionPopover() {
    if (mentionPopover && mentionPopover.node) mentionPopover.node.remove();
    mentionPopover = null;
  }

  function renderMentionList(popoverState) {
    const filtered = popoverState.items;

    popoverState.list.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "gala-mention-empty";
      empty.textContent = "暂无已上传素材，请先在页面素材槽中上传";
      popoverState.list.appendChild(empty);
      return;
    }

    filtered.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gala-mention-item";

      const preview = document.createElement("span");
      preview.className = "gala-mention-item-preview";
      const previewContent = attachmentPreview(item.file);
      previewContent.className = previewContent.nodeName === "IMG" ? "gala-mention-item-preview-image" : "gala-mention-item-preview-icon";
      preview.appendChild(previewContent);
      button.appendChild(preview);

      const copy = document.createElement("span");
      copy.className = "gala-mention-item-copy";
      const label = document.createElement("span");
      label.className = "gala-mention-item-label";
      label.textContent = `@${item.label}`;
      const meta = document.createElement("span");
      meta.className = "gala-mention-item-meta";
      meta.textContent = item.meta;
      copy.append(label, meta);
      button.appendChild(copy);

      button.addEventListener("click", () => {
        const currentContext = findPageContext() || popoverState.context;
        replaceTrailingMentionTrigger(getPromptEditor(currentContext), `@${item.label} `);
        closeMentionPopover();
      });
      popoverState.list.appendChild(button);
    });
  }

  function openMentionPopover(context, anchor) {
    closeMentionPopover();
    const node = document.createElement("div");
    node.className = "gala-mention-popover";
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-label", "插入引用");

    const title = document.createElement("div");
    title.className = "gala-mention-title";
    const titleIcon = document.createElement("span");
    titleIcon.className = "gala-mention-title-icon";
    titleIcon.textContent = "@";
    const titleText = document.createElement("span");
    titleText.textContent = "可引用素材";
    title.append(titleIcon, titleText);
    node.appendChild(title);

    const list = document.createElement("div");
    list.className = "gala-mention-list";
    node.appendChild(list);
    document.body.appendChild(node);

    const popoverState = {
      node,
      context,
      anchor,
      list,
      items: collectMentionItems(context),
    };
    mentionPopover = popoverState;
    renderMentionList(popoverState);

    const rect = anchor.getBoundingClientRect();
    const editor = getPromptEditor(context);
    const editorRect = editor && editor.getBoundingClientRect();
    const selection = window.getSelection();
    const range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
    const rangeRect = range && editor && editor.contains(range.commonAncestorContainer) ? range.getBoundingClientRect() : null;
    const originLeft = rangeRect && rangeRect.left > 0 ? rangeRect.left : editorRect && editorRect.left > 0 ? editorRect.left + 4 : rect.left;
    const originTop = rangeRect && rangeRect.top > 0 ? rangeRect.top : editorRect && editorRect.top > 0 ? editorRect.top : rect.top;
    const originBottom = rangeRect && rangeRect.bottom > 0 ? rangeRect.bottom : editorRect && editorRect.top > 0 ? editorRect.top + 28 : rect.top;
    const width = Math.min(320, window.innerWidth - 28);
    const left = Math.max(14, Math.min(originLeft - 18, window.innerWidth - width - 14));
    const belowTop = originBottom + 8;
    const maxTop = Math.max(14, window.innerHeight - node.offsetHeight - 14);
    const top = belowTop <= maxTop ? belowTop : Math.max(14, originTop - node.offsetHeight - 8);
    node.style.width = `${width}px`;
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  }

  function ensurePromptTools(context, wrapper, editor) {
    if (!wrapper) return;
    let tools = wrapper.querySelector(":scope > .gala-prompt-tools");
    if (!tools) {
      tools = document.createElement("div");
      tools.className = "gala-prompt-tools";
      tools.dataset.galaPromptTools = context.config.key;
      wrapper.appendChild(tools);
    }

    let strip = tools.querySelector(".gala-attachment-strip");
    if (!strip) {
      strip = document.createElement("div");
      strip.className = "gala-attachment-strip";
      strip.setAttribute("aria-label", "已添加附件");
      tools.appendChild(strip);
    }

    let wan30Summary = tools.querySelector(".gala-wan30-input-summary");
    if (!wan30Summary) {
      wan30Summary = document.createElement("div");
      wan30Summary.className = "gala-wan30-input-summary";
      wan30Summary.hidden = true;
      tools.appendChild(wan30Summary);
    }

    let row = tools.querySelector(".gala-prompt-tools-row");
    if (!row) {
      row = document.createElement("div");
      row.className = "gala-prompt-tools-row";
      tools.appendChild(row);
    }

    let fileInput = tools.querySelector(".gala-attachment-file-input");
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.className = "gala-attachment-file-input";
      fileInput.type = "file";
      fileInput.hidden = true;
      tools.appendChild(fileInput);
    }

    const wan30 = isWan30VideoContext(context);
    fileInput.multiple = !wan30;
    fileInput.accept = wan30 ? "image/*,video/*" : "image/*,video/*,audio/*,.pdf,.txt";

    function ensureButton(action, label, className, ariaLabel) {
      let button = row.querySelector(`[data-gala-prompt-action="${action}"]`);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.dataset.galaPromptAction = action;
        row.appendChild(button);
      }
      button.className = `gala-prompt-tool-button ${className || ""}`.trim();
      button.textContent = label;
      button.setAttribute("aria-label", ariaLabel || label);
      if (action === "variable") {
        if (!button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", "false");
        button.title = button.getAttribute("aria-pressed") === "true" ? "取消变量选择" : "将选中文字设为变量";
      }
      return button;
    }

    const plus = ensureButton("attach", "", "gala-prompt-tool-button--symbol gala-prompt-tool-button--primary", "添加附件");
    const mention = ensureButton("mention", "", "gala-prompt-tool-button--symbol", "插入引用");
    const variable = ensureButton("variable", "", "gala-prompt-tool-button--symbol", "设为变量");
    const optimize = ensureButton("optimize", "", "gala-prompt-tool-button--symbol", "优化提示词");
    const translate = ensureButton("translate", "", "gala-prompt-tool-button--symbol", "翻译提示词");

    if (!tools.dataset.galaEventsBound) {
      tools.dataset.galaEventsBound = "true";
      plus.addEventListener("click", () => {
        const currentContext = findPageContext() || context;
        if (currentContext.config.key === "video") {
          openPromptAttachmentSourceMenu(plus, currentContext, fileInput);
          return;
        }
        fileInput.click();
      });
      fileInput.addEventListener("change", () => {
        const currentContext = findPageContext() || context;
        const files = Array.from(fileInput.files || []);
        const list = getAttachmentList(currentContext.config.key);
         files.forEach((file) => {
           if (!list.some((existing) => attachmentKey(existing) === attachmentKey(file))) list.push(file);
         });
        const currentTools = currentContext.input?.querySelector(".gala-prompt-tools");
        const currentStrip = currentTools?.querySelector(".gala-attachment-strip") || strip;
        if (currentContext.config.key === "video") {
          startAttachmentUpload(currentContext, files, currentStrip);
        } else {
          startAttachmentReview(currentContext, files, currentStrip);
        }
        syncReferenceInputs(currentContext, files);
        renderAttachments(currentContext, currentStrip);
        if (mentionPopover) {
          mentionPopover.items = collectMentionItems(currentContext);
          renderMentionList(mentionPopover);
        }
        schedulePromptResize(currentContext, getPromptEditor(currentContext));
        fileInput.value = "";
      });
      mention.addEventListener("click", () => {
        const currentContext = findPageContext() || context;
        const currentEditor = getPromptEditor(currentContext);
        if (currentEditor) currentEditor.dataset.galaMentionButtonInsert = "true";
        insertEditorText(currentEditor, "@");
        if (currentEditor) delete currentEditor.dataset.galaMentionButtonInsert;
        openMentionPopover(currentContext, mention);
      });
      optimize.addEventListener("click", () => {
        const currentContext = findPageContext() || context;
        runPromptAssist(currentContext, "optimize", optimize);
      });
      translate.addEventListener("click", () => {
        const currentContext = findPageContext() || context;
        runPromptAssist(currentContext, "translate", translate);
      });
      variable.addEventListener("mousedown", (event) => event.preventDefault());
      variable.addEventListener("click", () => togglePromptVariableMode(variable));
    }

    renderAttachments(context, strip);
    bindPromptResize(context, editor);
    bindTypedMentionTrigger(context, editor, mention);
  }

  function setupAnglePrompt(context) {
    if (!context || !context.input) return;
    const scope = context.inputScroll || context.input;
    const section = Array.from(scope.querySelectorAll("section"))
      .find((candidate) => /自定义提示词/.test(cleanText(candidate.textContent)));
    const editor = section && section.querySelector("textarea");
    if (!section || !editor) return;

    section.classList.add("gala-angle-prompt-section");
    editor.classList.add("gala-angle-prompt-editor");
    const editorHost = editor.parentElement;
    if (!editorHost) return;
    editorHost.classList.add("gala-angle-prompt-composer");

    let row = editorHost.querySelector(":scope > .gala-angle-prompt-tools");
    if (!row) {
      row = document.createElement("div");
      row.className = "gala-angle-prompt-tools";
      row.setAttribute("aria-label", "提示词操作");
      editorHost.appendChild(row);
    }

    function ensureButton(action, ariaLabel) {
      let button = row.querySelector(`[data-gala-prompt-action="${action}"]`);
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.dataset.galaPromptAction = action;
        row.appendChild(button);
      }
      button.className = "gala-prompt-tool-button gala-prompt-tool-button--symbol";
      button.textContent = "";
      button.setAttribute("aria-label", ariaLabel);
      if (action === "variable") {
        if (!button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", "false");
        button.title = button.getAttribute("aria-pressed") === "true" ? "取消变量选择" : "将选中文字设为变量";
      }
      return button;
    }

    const variable = ensureButton("variable", "设为变量");
    const optimize = ensureButton("optimize", "优化提示词");
    const translate = ensureButton("translate", "翻译提示词");

    if (!row.dataset.galaEventsBound) {
      row.dataset.galaEventsBound = "true";
      optimize.addEventListener("click", () => runPromptAssist(context, "optimize", optimize));
      translate.addEventListener("click", () => runPromptAssist(context, "translate", translate));
      variable.addEventListener("mousedown", (event) => event.preventDefault());
      variable.addEventListener("click", () => togglePromptVariableMode(variable));
    }

    context.promptWrapper = editorHost;
    context.promptSection = section;
  }

  function findCanvasPromptEditor(promptNode) {
    return promptNode?.querySelector('.prompt-variable-textarea-editor[contenteditable="true"]') ||
      promptNode?.querySelector('[contenteditable="true"][role="textbox"]');
  }

  function clickCanvasNativePromptButton(button) {
    if (!button || button.disabled) return;
    button.dataset.galaCanvasNativeClick = "true";
    button.click();
    delete button.dataset.galaCanvasNativeClick;
  }

  function waitForCanvasPromptToolPanel(promptNode, timeout = 1200) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const check = () => {
        const panel = promptNode.querySelector(":scope > .prompt-tool-panel");
        if (panel) {
          resolve(panel);
          return;
        }
        if (Date.now() - startedAt >= timeout) {
          resolve(null);
          return;
        }
        window.setTimeout(check, 24);
      };
      check();
    });
  }

  function finishCanvasPromptTranslation(promptNode, trigger, panel) {
    if (trigger.disabled) {
      window.setTimeout(() => finishCanvasPromptTranslation(promptNode, trigger, panel), 180);
      return;
    }
    promptNode.removeAttribute("data-gala-canvas-translate-silent");
    panel?.classList.remove("gala-prompt-assist-hidden");
    clickCanvasNativePromptButton(trigger);
    delete trigger.dataset.galaCanvasTranslateBusy;
  }

  function runCanvasPromptTranslation(promptNode, trigger) {
    if (!promptNode || !trigger || trigger.dataset.galaCanvasTranslateBusy === "true") return;
    const editor = findCanvasPromptEditor(promptNode);
    const value = promptText(editor);
    if (!value) {
      editor?.focus({ preventScroll: true });
      return;
    }

    trigger.dataset.galaCanvasTranslateBusy = "true";
    promptNode.dataset.galaCanvasTranslateSilent = "true";
    const existingPanel = promptNode.querySelector(":scope > .prompt-tool-panel");
    const openPanel = () => {
      clickCanvasNativePromptButton(trigger);
      waitForCanvasPromptToolPanel(promptNode).then((panel) => {
        if (!panel) {
          promptNode.removeAttribute("data-gala-canvas-translate-silent");
          delete trigger.dataset.galaCanvasTranslateBusy;
          return;
        }

        panel.classList.add("gala-prompt-assist-hidden");
        const direction = detectPromptLanguage(value);
        const option = Array.from(panel.querySelectorAll(".prompt-translate-options button"))
          .find((button) => {
            const label = cleanText(button.textContent);
            return direction === "en-zh" ? /英.*中/.test(label) : /中.*英/.test(label);
          });
        if (option && option.getAttribute("aria-pressed") !== "true") option.click();

        window.setTimeout(() => {
          const runButton = panel.querySelector(".prompt-tool-panel-footer button");
          if (!runButton || runButton.disabled) {
            finishCanvasPromptTranslation(promptNode, trigger, panel);
            return;
          }
          runButton.click();

          let attempts = 0;
          const waitUntilIdle = () => {
            attempts += 1;
            if (!promptNode.isConnected || !panel.isConnected) {
              delete trigger.dataset.galaCanvasTranslateBusy;
              promptNode.removeAttribute("data-gala-canvas-translate-silent");
              return;
            }
            if (attempts > 1 && !runButton.disabled) {
              finishCanvasPromptTranslation(promptNode, trigger, panel);
              return;
            }
            if (attempts >= 120) {
              finishCanvasPromptTranslation(promptNode, trigger, panel);
              return;
            }
            window.setTimeout(waitUntilIdle, 50);
          };
          window.setTimeout(waitUntilIdle, 150);
        }, 40);
      });
    };

    if (existingPanel) {
      clickCanvasNativePromptButton(trigger);
      window.setTimeout(openPanel, 32);
    } else {
      openPanel();
    }
  }

  function setupCanvasPromptNodes() {
    document.querySelectorAll(".canvas-shell .prompt-editor").forEach((promptNode) => {
      const toolbar = promptNode.querySelector(":scope > .prompt-toolbar .prompt-tool-buttons");
      const editor = findCanvasPromptEditor(promptNode);
      if (!toolbar || !editor) return;

      const buttons = Array.from(toolbar.querySelectorAll(":scope > button.prompt-template-btn"));
      const favorite = buttons.find((button) => /收藏/.test(cleanText(button.title || button.textContent))) || buttons[1];
      const optimize = buttons.find((button) => /优化/.test(cleanText(button.title || button.textContent)));
      const translate = buttons.find((button) => /翻译/.test(cleanText(button.title || button.textContent)));

      let variable = toolbar.querySelector(':scope > [data-gala-prompt-action="variable"]');
      if (!variable) {
        variable = document.createElement("button");
        variable.type = "button";
        variable.dataset.galaPromptAction = "variable";
        variable.textContent = "变量";
        variable.className = "prompt-template-btn gala-canvas-variable-btn";
        variable.setAttribute("aria-label", "设为变量");
        variable.setAttribute("aria-pressed", "false");
        variable.title = "将选中文字设为变量";
        if (favorite) toolbar.insertBefore(variable, favorite.nextSibling);
        else if (optimize) toolbar.insertBefore(variable, optimize);
        else toolbar.appendChild(variable);
      }

      variable.className = "prompt-template-btn gala-canvas-variable-btn";
      variable.textContent = "变量";
      variable.setAttribute("aria-label", "设为变量");
      if (!variable.hasAttribute("aria-pressed")) variable.setAttribute("aria-pressed", "false");
      variable.title = variable.getAttribute("aria-pressed") === "true" ? "取消变量选择" : "将选中文字设为变量";
      if (!variable.dataset.galaEventsBound) {
        variable.dataset.galaEventsBound = "true";
        variable.addEventListener("mousedown", (event) => event.preventDefault());
        variable.addEventListener("click", () => togglePromptVariableMode(variable));
      }

      if (translate && !translate.dataset.galaCanvasTranslateBound) {
        translate.dataset.galaCanvasTranslateBound = "true";
        translate.addEventListener("click", (event) => {
          if (translate.dataset.galaCanvasNativeClick === "true") return;
          event.preventDefault();
          event.stopPropagation();
          runCanvasPromptTranslation(promptNode, translate);
        });
      }
    });
  }

  function setupCanvasMediaLimitStatus() {
    const isCanvas = getRouteName() === "canvas";
    document.body.classList.toggle("gala-canvas-media-limit-page", isCanvas);
    if (!isCanvas) return;

    document.querySelectorAll(".canvas-node.generator-node, .canvas-node.video-node").forEach((node) => {
      const head = node.querySelector(":scope > .node-head") || node.querySelector(".node-head");
      if (!head) return;

      const isVideoNode = node.classList.contains("video-node");
      const isWan30 = isVideoNode && isWan30CanvasVideoNode(node);
      const counts = { image: 0, video: 0, audio: 0, file: 0 };
      const inputList = node.querySelector(isVideoNode ? ".video-img-list" : ".generator-body > .input-list, .generator-body .input-list");
      const body = node.querySelector(":scope > .node-body") || node.querySelector(".node-body");
      const statusHost = inputList?.parentElement || body;
      const statusReference = inputList || body?.querySelector(":scope > .gen-settings");
      inputList?.querySelectorAll(isVideoNode ? ".video-input-item" : ":scope > .input-item").forEach((item) => {
        const text = cleanText(item.textContent);
        const kind = item.querySelector(".video-input-audio, audio") || /音频/.test(text)
          ? "audio"
          : item.querySelector("video") || /视频/.test(text)
            ? "video"
            : "image";
        counts[kind] += 1;
      });

      if (isWan30) counts.file = inputList?.querySelectorAll(".video-input-item").length || 0;

      const limits = isVideoNode
        ? { image: 30, video: 10, audio: 10, ...(isWan30 ? { file: 1 } : {}) }
        : { image: 14 };
      const labels = isVideoNode
        ? { image: "\u56fe\u7247", video: "\u89c6\u9891", audio: "\u97f3\u9891", ...(isWan30 ? { file: "\u6587\u4ef6" } : {}) }
        : { image: "\u56fe\u7247" };
      const overKinds = Object.keys(labels).filter((kind) => counts[kind] > limits[kind]);
      const overLimit = overKinds.length > 0;

      let status = node.querySelector("[data-gala-media-limit-status]");
      if (!status) {
        status = document.createElement("div");
        status.dataset.galaMediaLimitStatus = "true";
      }
      if (statusHost) {
        if (inputList && status.previousElementSibling !== inputList) {
          statusHost.insertBefore(status, statusReference.nextSibling);
        } else if (!inputList && statusReference && status.nextElementSibling !== statusReference) {
          statusHost.insertBefore(status, statusReference);
        } else if (!statusReference && status.parentElement !== statusHost) {
          statusHost.appendChild(status);
        }
      }

      status.className = "gala-media-limit-status";
      status.setAttribute("role", "group");
      status.setAttribute("aria-label", "\u8f93\u5165\u7d20\u6750\u6570\u91cf\u9650\u5236");
      status.dataset.hasError = overLimit ? "true" : "false";
      status.title = isWan30
        ? "\u6587\u4ef6\u6700\u591a 1 \u4e2a"
        : isVideoNode
          ? "\u8f93\u5165\u7d20\u6750\uff1a\u56fe\u7247\u6700\u591a 30 \u4e2a\uff0c\u89c6\u9891\u6700\u591a 10 \u4e2a\uff0c\u97f3\u9891\u6700\u591a 10 \u4e2a"
        : "\u8f93\u5165\u7d20\u6750\uff1a\u56fe\u7247\u6700\u591a 14 \u4e2a";

      const title = document.createElement("span");
      title.className = "gala-media-limit-title";
      title.textContent = "\u8f93\u5165\u7d20\u6750";
      status.replaceChildren(title);

      Object.keys(labels).forEach((kind) => {
        const count = counts[kind];
        const limit = limits[kind];
        const item = document.createElement("span");
        const state = count > limit ? "over" : count / limit >= 0.8 ? "near" : "normal";
        item.className = "gala-media-limit-item";
        item.dataset.galaMediaKind = kind;
        item.dataset.state = state;
        item.dataset.count = String(count);
        item.dataset.limit = String(limit);
        item.setAttribute("aria-label", `${labels[kind]} ${count}/${limit}`);

        const label = document.createElement("span");
        label.className = "gala-media-limit-item-label";
        label.textContent = labels[kind];
        const current = document.createElement("strong");
        current.className = "gala-media-limit-item-current";
        current.textContent = String(count);
        const max = document.createElement("span");
        max.className = "gala-media-limit-item-limit";
        max.textContent = `/${limit}`;
        item.append(label, current, max);
        status.appendChild(item);
      });

      let error = node.querySelector("[data-gala-media-limit-error]");
      if (overLimit) {
        if (!error) {
          error = document.createElement("div");
          error.dataset.galaMediaLimitError = "true";
        }
        error.className = "gala-media-limit-error";
        error.setAttribute("role", "alert");
        error.setAttribute("aria-live", "polite");
        const details = overKinds
          .map((kind) => `${labels[kind]}\u6700\u591a ${limits[kind]} \u4e2a\uff0c\u5f53\u524d ${counts[kind]} \u4e2a`)
          .join("\uff1b");
        const icon = document.createElement("span");
        icon.className = "gala-media-limit-error-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "!";
        const message = document.createElement("span");
        message.textContent = `\u8f93\u5165\u7d20\u6750\u8d85\u51fa\u9650\u5236\uff1a${details}\uff0c\u8bf7\u79fb\u9664\u591a\u4f59\u7d20\u6750\u540e\u518d\u751f\u6210`;
        error.replaceChildren(icon, message);
        if (statusHost && (error.parentElement !== statusHost || error.previousElementSibling !== status)) {
          statusHost.insertBefore(error, status.nextSibling);
        }
      } else {
        error?.remove();
      }

      const runButton = node.querySelector(".gen-btn");
      if (runButton) {
        if (!runButton.dataset.galaMediaLimitBaseline) {
          runButton.dataset.galaMediaLimitBaseline = runButton.disabled ? "disabled" : "enabled";
        }
        if (overLimit) {
          runButton.dataset.galaMediaLimitBlocked = "true";
          runButton.disabled = true;
          runButton.title = "\u8bf7\u79fb\u9664\u8d85\u51fa\u9650\u5236\u7684\u8f93\u5165\u7d20\u6750";
        } else if (runButton.dataset.galaMediaLimitBlocked === "true") {
          if (runButton.dataset.galaMediaLimitBaseline === "enabled") runButton.disabled = false;
          delete runButton.dataset.galaMediaLimitBlocked;
          if (runButton.title === "\u8bf7\u79fb\u9664\u8d85\u51fa\u9650\u5236\u7684\u8f93\u5165\u7d20\u6750") runButton.removeAttribute("title");
        }
      }

      Array.from(head.children).forEach((child) => {
        if (child === status || child.hasAttribute("data-gala-media-limit-status")) return;
        const text = cleanText(child.textContent);
        const isLegacyLimit = isVideoNode
          ? /\u56fe\u7247\s*\d+\s*\/\s*30/.test(text) && /\u89c6\u9891\s*\d+\s*\/\s*10/.test(text)
          : /\u56fe\u7247\s*\d+\s*\/\s*14/.test(text);
        if (isLegacyLimit) {
          child.classList.add("gala-canvas-media-limit-legacy");
        }
      });
    });
  }

  function isCanvasGenericFile(file) {
    const type = String(file?.type || "").toLowerCase();
    const name = String(file?.name || "").toLowerCase();
    if (/^(image|video|audio)\//.test(type)) return false;
    return !/\.(png|jpe?g|webp|gif|bmp|avif|svg|mp4|mov|webm|mkv|avi|m4v|mp3|wav|m4a|aac|ogg|flac)$/i.test(name);
  }

  function canvasUploadNodeId(node) {
    return node?.dataset?.canvasNodeId || node?.dataset?.id || "";
  }

  function canvasPrototypeMediaKind(file) {
    const type = String(file?.type || "").toLowerCase();
    if (type.startsWith("image/")) return "image";
    if (type.startsWith("video/")) return "video";
    if (type.startsWith("audio/")) return "audio";
    return "file";
  }

  function canvasPrototypeMediaTitle(kind) {
    return ({
      image: "IMAGE",
      video: "\u89c6\u9891",
      audio: "\u97f3\u9891",
      file: "\u6587\u4ef6",
    })[kind] || "\u6587\u4ef6";
  }

  function canvasPrototypeStatusLabel(phase) {
    return ({
      uploading: "\u4e0a\u4f20\u4e2d",
      reviewing: "\u5ba1\u6838\u4e2d",
      failed: "\u5ba1\u6838\u5931\u8d25",
    })[phase] || "";
  }

  function canvasNodeHasUploadSlot(node) {
    return Boolean(
      node?.querySelector(":scope > .node-body .blank-image")
      || node?.querySelector(":scope > .node-body [data-gala-canvas-upload-slot]")
      || node?.querySelector(".blank-image")
      || node?.querySelector("[data-gala-canvas-upload-slot]"),
    );
  }

  function captureCanvasPrototypeUploadFrameSize(node) {
    if (!node || (canvasPrototypeUploadFrameSize.width && canvasPrototypeUploadFrameSize.height)) return;
    const width = Number(node.offsetWidth) || Number.parseFloat(window.getComputedStyle(node).width);
    const height = Number(node.offsetHeight) || Number.parseFloat(window.getComputedStyle(node).height);
    if (width > 0 && height > 0) {
      canvasPrototypeUploadFrameSize.width = Math.round(width);
      canvasPrototypeUploadFrameSize.height = Math.round(height);
    }
  }

  function findCanvasUploadInput() {
    return document.querySelector('input[type="file"][data-gala-canvas-upload-input="true"]')
      || Array.from(document.querySelectorAll('input[type="file"]')).find((input) => (
        input.classList.contains("hidden")
        && !input.closest(".canvas-shell")
        && !input.closest(".prompt-template-media-editor, .workflow-upload-input")
      ))
      || document.querySelector('.canvas-shell input[type="file"]')
      || document.querySelector('input[type="file"]');
  }

  function canvasPrototypeNodeTransform(node, offset = 0) {
    const transform = node?.style?.transform || "";
    const match = transform.match(/translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\s*\)/);
    if (!match) return offset ? `translate(${offset}px, ${offset}px)` : transform;
    return `translate(${Number(match[1]) + offset}px, ${Number(match[2]) + offset}px)`;
  }

  function preserveCanvasPrototypeNodeSize(node, source = node) {
    if (!node) return null;
    const nodeId = canvasUploadNodeId(node);
    if (!nodeId) return null;
    captureCanvasPrototypeUploadFrameSize(source || node);
    const measuredWidth = canvasPrototypeUploadFrameSize.width
      || Number(source?.offsetWidth)
      || Number(node.offsetWidth);
    const measuredHeight = canvasPrototypeUploadFrameSize.height
      || Number(source?.offsetHeight)
      || Number(node.offsetHeight);
    const size = {
      // All upload nodes share the first upload node's frame. Falling back to
      // the canvas image-node default keeps the frame stable even when the
      // native renderer has already replaced the body with compact content.
      width: Math.max(1, Math.round(measuredWidth || CANVAS_UPLOAD_NODE_DEFAULT_SIZE.width)),
      height: Math.max(1, Math.round(measuredHeight || CANVAS_UPLOAD_NODE_DEFAULT_SIZE.height)),
    };
    if (!canvasPrototypeUploadFrameSize.width) canvasPrototypeUploadFrameSize.width = size.width;
    if (!canvasPrototypeUploadFrameSize.height) canvasPrototypeUploadFrameSize.height = size.height;
    canvasPrototypeUploadSizes.set(nodeId, size);
    node.style.setProperty("--gala-canvas-upload-node-width", `${size.width}px`);
    node.style.setProperty("--gala-canvas-upload-node-height", `${size.height}px`);
    node.style.setProperty("width", `${size.width}px`, "important");
    node.style.setProperty("height", `${size.height}px`, "important");
    node.style.setProperty("min-width", `${size.width}px`, "important");
    node.style.setProperty("max-width", `${size.width}px`, "important");
    node.style.setProperty("min-height", `${size.height}px`, "important");
    node.style.setProperty("max-height", `${size.height}px`, "important");
    return size;
  }

  function removeCanvasPrototypeUploadNode(node) {
    const nodeId = canvasUploadNodeId(node);
    const previewUrl = canvasPrototypeUploadUrls.get(nodeId);
    if (previewUrl && window.URL) URL.revokeObjectURL(previewUrl);
    canvasPrototypeUploadUrls.delete(nodeId);
    canvasPrototypeUploadStates.delete(nodeId);
    canvasPrototypeUploadSizes.delete(nodeId);
    canvasFileNodeStates.delete(nodeId);
    node?.remove();
    scheduleApply();
  }

  function bindCanvasPrototypeUploadNode(node) {
    if (!node || node.dataset.galaCanvasPrototypeControlsBound === "true") return;
    node.dataset.galaCanvasPrototypeControlsBound = "true";
    node.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const remove = target.closest("[data-gala-canvas-prototype-remove]")
        || target.closest(".node-head button");
      if (remove && node.contains(remove)) {
        event.preventDefault();
        event.stopPropagation();
        removeCanvasPrototypeUploadNode(node);
        return;
      }

      if (!target.closest("[data-gala-canvas-upload-slot]")) return;
      event.preventDefault();
      event.stopPropagation();
      canvasUploadTargetNodeId = canvasUploadNodeId(node);
      const input = findCanvasUploadInput();
      if (!input) return;
      input.value = "";
      input.click();
    });
  }

  function renderCanvasPrototypeUploadSlot(node) {
    if (!node) return;
    preserveCanvasPrototypeNodeSize(node);
    const body = node.querySelector(":scope > .node-body") || node.querySelector(".node-body");
    if (!body) return;
    if (node.dataset.galaCanvasPrototypeRendered === "slot"
      && body.querySelector("[data-gala-canvas-upload-slot]")) {
      bindCanvasPrototypeUploadNode(node);
      return;
    }
    node.classList.add("gala-canvas-prototype-upload");
    node.classList.remove("has-image");
    node.removeAttribute("data-gala-canvas-file-node");
    delete node.dataset.galaCanvasFileName;
    delete node.dataset.galaCanvasReviewPhase;
    delete node.dataset.galaCanvasProviderStatus;
    node.dataset.galaCanvasPrototypeUploadSlot = "true";

    const title = node.querySelector(":scope > .node-head .node-title") || node.querySelector(".node-title");
    if (title) title.textContent = CANVAS_UPLOAD_LABEL;

    const slot = document.createElement("div");
    slot.className = "gala-canvas-upload-slot";
    slot.dataset.galaCanvasUploadSlot = "true";
    const icon = document.createElement("span");
    icon.className = "gala-canvas-upload-slot-icon";
    icon.textContent = "+";
    const label = document.createElement("span");
    label.className = "gala-canvas-upload-slot-label";
    label.textContent = CANVAS_UPLOAD_LABEL;
    slot.append(icon, label);
    body.replaceChildren(slot);
    node.dataset.galaCanvasPrototypeRendered = "slot";
    bindCanvasPrototypeUploadNode(node);
  }

  function scheduleCanvasPrototypeUpload(node, state) {
    if (!node || !state?.file) return;
    const nodeId = canvasUploadNodeId(node);
    const token = `${Date.now()}-${Math.random()}`;
    state.phase = "uploading";
    state.provider = "";
    state.providerStatus = "";
    state.token = token;
    renderCanvasPrototypeUploadNode(node);

    window.setTimeout(() => {
      const current = canvasPrototypeUploadStates.get(nodeId);
      if (current !== state || current.token !== token) return;
      state.phase = "success";
      renderCanvasPrototypeUploadNode(node);
    }, 1100);
  }

  function retryCanvasPrototypeUpload(node) {
    const nodeId = canvasUploadNodeId(node);
    const state = canvasPrototypeUploadStates.get(nodeId);
    if (!state?.file) return;
    scheduleCanvasPrototypeUpload(node, state);
  }

  function renderCanvasPrototypeUploadNode(node) {
    if (!node) return;
    preserveCanvasPrototypeNodeSize(node);
    const nodeId = canvasUploadNodeId(node);
    const state = canvasPrototypeUploadStates.get(nodeId);
    if (!state) {
      renderCanvasPrototypeUploadSlot(node);
      return;
    }
    const body = node.querySelector(":scope > .node-body") || node.querySelector(".node-body");
    if (!body) return;
    const renderKey = `${state.phase}:${state.providerStatus || ""}:${state.kind}:${state.file?.name || ""}`;
    const expectedBody = "[data-gala-canvas-uploaded-media]";
    if (node.dataset.galaCanvasPrototypeRendered === renderKey && body.querySelector(expectedBody)) {
      bindCanvasPrototypeUploadNode(node);
      return;
    }
    node.classList.add("gala-canvas-prototype-upload");
    if (state.kind === "file") node.dataset.galaCanvasFileNode = "true";
    else node.removeAttribute("data-gala-canvas-file-node");
    node.dataset.galaCanvasFileName = state.file?.name || "";
    node.dataset.galaCanvasReviewPhase = state.phase;
    node.dataset.galaCanvasMediaKind = state.kind;
    if (state.providerStatus) node.dataset.galaCanvasProviderStatus = state.providerStatus;
    else delete node.dataset.galaCanvasProviderStatus;
    node.classList.toggle(
      "has-image",
      Boolean(state.file) && state.phase !== "uploading" && (state.kind === "image" || state.kind === "video"),
    );

    const title = node.querySelector(":scope > .node-head .node-title") || node.querySelector(".node-title");
    if (title) title.textContent = state.file
      ? canvasPrototypeMediaTitle(state.kind)
      : CANVAS_UPLOAD_LABEL;

    // Uploading and provider review are separate states: do not reveal the
    // media preview until the upload itself has completed.
    if (state.file && state.phase !== "uploading") {
      const card = document.createElement("div");
      card.className = "gala-canvas-uploaded-media";
      card.dataset.galaCanvasUploadedMedia = state.kind;
      const file = state.file;
      if ((state.kind === "image" || state.kind === "video") && file && window.URL?.createObjectURL) {
        let previewUrl = canvasPrototypeUploadUrls.get(nodeId);
        if (!previewUrl) {
          previewUrl = URL.createObjectURL(file);
          canvasPrototypeUploadUrls.set(nodeId, previewUrl);
        }
        const media = document.createElement(state.kind === "video" ? "video" : "img");
        media.className = "gala-canvas-uploaded-media-preview";
        media.src = previewUrl;
        if (state.kind === "video") {
          media.muted = true;
          media.playsInline = true;
          media.preload = "metadata";
        } else {
          media.alt = file.name || "";
        }
        card.appendChild(media);
      } else {
        const icon = document.createElement("span");
        icon.className = "gala-canvas-uploaded-media-icon";
        icon.textContent = state.kind === "audio" ? "♫" : "▤";
        const name = document.createElement("span");
        name.className = "gala-canvas-uploaded-media-name";
        name.textContent = file?.name || "";
        card.append(icon, name);
      }
      const providerStatus = state.phase === "uploading"
        ? "上传中"
        : state.phase === "reviewing"
          ? "火山检查中"
          : state.providerStatus === "rejected"
            ? "审核失败"
            : "";
      if (providerStatus) {
        const badge = document.createElement("span");
        badge.className = `gala-canvas-provider-status ${state.phase === "reviewing" ? "is-pending" : ""} ${state.providerStatus === "rejected" ? "is-rejected" : ""}`.trim();
        badge.title = state.providerStatus === "rejected"
          ? "火山素材库审核未通过，其他模型仍可使用"
          : providerStatus;
        const label = document.createElement("span");
        label.textContent = providerStatus;
        badge.appendChild(label);
        if (state.providerStatus === "rejected") {
          const retry = document.createElement("button");
          retry.type = "button";
          retry.className = "gala-canvas-provider-retry";
          retry.textContent = "重试";
          retry.setAttribute("aria-label", "重试火山素材库审核");
          retry.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            retryCanvasPrototypeUpload(node);
          });
          badge.appendChild(retry);
        }
        card.appendChild(badge);
      }
      body.replaceChildren(card);
      node.dataset.galaCanvasPrototypeRendered = renderKey;
      bindCanvasPrototypeUploadNode(node);
      return;
    }

    const status = document.createElement("div");
    status.className = `gala-canvas-upload-status gala-canvas-upload-status--${state.phase}`;
    const indicator = document.createElement("span");
    if (state.phase === "failed") {
      indicator.className = "gala-canvas-upload-status-icon";
      indicator.textContent = "!";
    } else {
      indicator.className = "gala-canvas-upload-status-spinner";
    }
    const label = document.createElement("strong");
    label.textContent = canvasPrototypeStatusLabel(state.phase);
    const name = document.createElement("small");
    name.textContent = state.file?.name || "";
    status.append(indicator, label, name);
    body.replaceChildren(status);
    node.dataset.galaCanvasPrototypeRendered = renderKey;
    bindCanvasPrototypeUploadNode(node);
  }

  function cloneCanvasPrototypeUploadNode(source, offset = 0) {
    if (!source?.parentElement) return null;
    const node = source.cloneNode(true);
    const nodeId = `gala-canvas-upload-${Date.now()}-${++canvasPrototypeUploadSequence}`;
    node.dataset.canvasNodeId = nodeId;
    node.dataset.id = nodeId;
    node.dataset.galaCanvasPrototypeUpload = "true";
    node.classList.add("gala-canvas-prototype-upload", "image-node");
    node.classList.remove("selected", "has-image");
    node.removeAttribute("data-gala-canvas-file-node");
    node.removeAttribute("data-gala-canvas-file-name");
    delete node.dataset.galaCanvasPrototypeControlsBound;
    delete node.dataset.galaCanvasPrototypeRendered;
    delete node.dataset.galaCanvasPrototypeUploadSlot;
    delete node.dataset.galaCanvasReviewPhase;
    delete node.dataset.galaCanvasMediaKind;
    delete node.dataset.galaCanvasProviderStatus;
    node.style.transform = canvasPrototypeNodeTransform(source, offset);
    node.style.zIndex = String(110 + canvasPrototypeUploadSequence);
    source.parentElement.appendChild(node);
    preserveCanvasPrototypeNodeSize(node, source);
    bindCanvasPrototypeUploadNode(node);
    return node;
  }

  function removeEmptyCanvasPrototypeUploadSlots() {
    document.querySelectorAll(".canvas-node.gala-canvas-prototype-upload")
      .forEach((node) => {
        if (!canvasNodeHasUploadSlot(node)) return;
        const nodeId = canvasUploadNodeId(node);
        if (nodeId && canvasPrototypeUploadStates.has(nodeId)) return;
        removeCanvasPrototypeUploadNode(node);
      });
  }

  function startCanvasPrototypeUpload(files, preferredNodeId = "") {
    const selectedFiles = Array.from(files || []).filter(Boolean);
    if (!selectedFiles.length) return false;
    let source = findCanvasFileTargetNode(preferredNodeId);
    if (!source) return false;

    captureCanvasPrototypeUploadFrameSize(source);
    const sourceHasUploadSlot = canvasNodeHasUploadSlot(source);
    if (!sourceHasUploadSlot) {
      const slot = cloneCanvasPrototypeUploadNode(source, 42);
      if (!slot) return false;
      renderCanvasPrototypeUploadSlot(slot);
      source = slot;
    }

    if (!source.dataset.galaCanvasPrototypeUpload) {
      source.dataset.galaCanvasPrototypeUpload = "true";
      source.classList.add("gala-canvas-prototype-upload", "image-node");
      source.classList.remove("selected", "has-image");
      bindCanvasPrototypeUploadNode(source);
    }
    preserveCanvasPrototypeNodeSize(source);

    selectedFiles.forEach((file, index) => {
      const node = index === 0 ? source : cloneCanvasPrototypeUploadNode(source, index * 34);
      if (!node) return;
      const nodeId = canvasUploadNodeId(node);
      const state = {
        file,
        kind: canvasPrototypeMediaKind(file),
        phase: "uploading",
        provider: "",
        providerStatus: "",
        token: `${Date.now()}-${Math.random()}`,
      };
      canvasPrototypeUploadStates.set(nodeId, state);
      if (state.kind === "file") {
        canvasFileNodeStates.set(nodeId, [file.name || "\u672a\u547d\u540d\u6587\u4ef6"]);
      }
      scheduleCanvasPrototypeUpload(node, state);
    });

    // Every selected file is represented by a filled node. Do not append an
    // extra empty uploader after the batch has been placed on the canvas.
    removeEmptyCanvasPrototypeUploadSlots();
    canvasUploadTargetNodeId = "";
    scheduleApply();
    return true;
  }

  function restoreCanvasPrototypeUploadNodes() {
    if (getRouteName() !== "canvas") return;
    canvasPrototypeUploadStates.forEach((state, nodeId) => {
      const node = Array.from(document.querySelectorAll(".canvas-node.image-node"))
        .find((candidate) => canvasUploadNodeId(candidate) === nodeId);
      if (!node) return;
      node.dataset.galaCanvasPrototypeUpload = "true";
      node.classList.add("gala-canvas-prototype-upload", "image-node");
      preserveCanvasPrototypeNodeSize(node);
      renderCanvasPrototypeUploadNode(node);
    });
    document.querySelectorAll(".canvas-node.gala-canvas-prototype-upload")
      .forEach((node) => {
        if (!canvasPrototypeUploadStates.has(canvasUploadNodeId(node))) {
          preserveCanvasPrototypeNodeSize(node);
          renderCanvasPrototypeUploadSlot(node);
        }
      });
  }

  function markCanvasPendingFileNodes() {
    if (getRouteName() !== "canvas" || !canvasPendingFileUploads.length) return;
    const nodes = Array.from(document.querySelectorAll(".canvas-node.image-node"));
    const now = Date.now();
    let markedAny = false;

    canvasPendingFileUploads = canvasPendingFileUploads.filter((pending) => {
      const candidates = nodes.filter((node) => {
        const id = canvasUploadNodeId(node);
        const ready = node.classList.contains("has-image") || !node.querySelector(".blank-image");
        const isNewNode = Boolean(id) && !pending.knownIds.has(id);
        return ready && (isNewNode || pending.blankIds.has(id) || id === pending.targetId);
      });

      if (!candidates.length && now - pending.createdAt < 3000) return true;
      candidates.forEach((node) => {
        markedAny = true;
        node.dataset.galaCanvasFileNode = "true";
        node.dataset.galaCanvasFileName = pending.names.join(", ");
        node.title = `\u6587\u4ef6\u8282\u70b9\uff1a${pending.names[0] || "\u672a\u547d\u540d\u6587\u4ef6"}`;
      });
      return false;
    });
    if (markedAny) scheduleApply();
  }

  function findCanvasFileTargetNode(preferredId = "") {
    const nodes = Array.from(document.querySelectorAll(".canvas-node.image-node"));
    if (preferredId) {
      const preferred = nodes.find((node) => canvasUploadNodeId(node) === preferredId);
      if (preferred && canvasNodeHasUploadSlot(preferred)) return preferred;
    }
    return nodes.find(canvasNodeHasUploadSlot)
      || nodes.find((node) => node.dataset.galaCanvasPrototypeUpload === "true")
      || nodes.find((node) => node.dataset.galaCanvasFileNode === "true")
      || null;
  }

  function activateCanvasFileNode(names, preferredId = "") {
    const node = findCanvasFileTargetNode(preferredId);
    if (!node) return false;
    const nodeId = canvasUploadNodeId(node);
    if (nodeId) canvasFileNodeStates.set(nodeId, [...names]);
    node.dataset.galaCanvasFileNode = "true";
    node.dataset.galaCanvasFileName = names.join(", ");
    node.title = `\u6587\u4ef6\u8282\u70b9\uff1a${names[0] || "\u672a\u547d\u540d\u6587\u4ef6"}`;
    renderCanvasFileNode(node);
    canvasUploadTargetNodeId = "";
    scheduleApply();
    return true;
  }

  function captureCanvasUploadSelection(input, event) {
    if (getRouteName() !== "canvas") return false;
    if (!input?.files?.length) {
      canvasUploadTargetNodeId = "";
      return false;
    }
    if (event?.[CANVAS_UPLOAD_EVENT_HANDLED]) return true;
    if (event) event[CANVAS_UPLOAD_EVENT_HANDLED] = true;
    const files = Array.from(input.files);
    if (!files.length) return false;

    // Canvas uploads are prototype-only inputs here: keep every selected
    // media item in its own node while the upload is simulated.
    event?.preventDefault();
    event?.stopImmediatePropagation();
    const targetNodeId = canvasUploadTargetNodeId;
    canvasUploadTargetNodeId = "";
    const activated = startCanvasPrototypeUpload(files, targetNodeId);
    try {
      input.value = "";
    } catch {
      // The visual node is already activated even if the input cannot clear.
    }
    return activated;
  }

  function bindCanvasUploadInput(input) {
    if (!input || input.dataset.galaCanvasUploadGuardBound === "true") return;
    input.dataset.galaCanvasUploadGuardBound = "true";
    input.addEventListener("change", (event) => {
      captureCanvasUploadSelection(input, event);
    }, true);
  }

  function canvasPortCenter(node, selector) {
    const port = node?.querySelector(selector);
    if (!port) return null;
    const rect = port.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function canvasPathScreenPoint(path, distance) {
    try {
      const svg = path.ownerSVGElement;
      const matrix = path.getScreenCTM();
      if (!svg || !matrix) return null;
      const local = path.getPointAtLength(distance);
      const point = svg.createSVGPoint();
      point.x = local.x;
      point.y = local.y;
      const screen = point.matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    } catch {
      return null;
    }
  }

  function canvasPointNear(first, second, threshold = 72) {
    if (!first || !second) return false;
    return Math.hypot(first.x - second.x, first.y - second.y) <= threshold;
  }

  function findCanvasFileConnections() {
    const fileNodes = Array.from(document.querySelectorAll(
      '.canvas-node.image-node[data-gala-canvas-file-node="true"]',
    ));
    const videoNodes = Array.from(document.querySelectorAll(".canvas-node.video-node"));
    const paths = Array.from(document.querySelectorAll(
      "[data-canvas-connections-layer] path[data-connection-id]",
    )).filter((path) => !path.classList.contains("link-hit"));
    const connections = [];

    paths.forEach((path) => {
      let length = 0;
      try {
        length = path.getTotalLength();
      } catch {
        return;
      }
      const start = canvasPathScreenPoint(path, 0);
      const end = canvasPathScreenPoint(path, length);
      if (!start || !end) return;

      fileNodes.forEach((fileNode) => {
        const fileOut = canvasPortCenter(fileNode, ".port.out");
        if (!fileOut) return;
        const fileAtStart = canvasPointNear(start, fileOut);
        const fileAtEnd = canvasPointNear(end, fileOut);
        if (!fileAtStart && !fileAtEnd) return;

        const targetPoint = fileAtStart ? end : start;
        const videoNode = videoNodes.find((candidate) => (
          canvasPointNear(targetPoint, canvasPortCenter(candidate, ".port.in"))
        ));
        if (videoNode) connections.push({ fileNode, videoNode });
      });
    });

    return connections;
  }

  function setupCanvasFileCompatibility() {
    if (getRouteName() !== "canvas") return;
    markCanvasPendingFileNodes();

    const fileSourcesByVideo = new Map();
    findCanvasFileConnections().forEach(({ fileNode, videoNode }) => {
      const sources = fileSourcesByVideo.get(videoNode) || [];
      if (!sources.includes(fileNode)) sources.push(fileNode);
      fileSourcesByVideo.set(videoNode, sources);
    });

    document.querySelectorAll(".canvas-node.video-node").forEach((node) => {
      const fileSources = fileSourcesByVideo.get(node) || [];
      const unsupported = fileSources.length > 0 && !isWan30CanvasVideoNode(node);
      node.dataset.galaFileInputSources = String(fileSources.length);

      const inputList = node.querySelector(".video-img-list");
      const body = node.querySelector(":scope > .node-body") || node.querySelector(".node-body");
      const status = node.querySelector("[data-gala-media-limit-status]");
      const host = status?.parentElement || inputList?.parentElement || body;
      let error = node.querySelector("[data-gala-file-input-error]");

      if (unsupported) {
        if (!error) {
          error = document.createElement("div");
          error.dataset.galaFileInputError = "true";
        }
        error.className = "gala-canvas-file-input-error";
        error.setAttribute("role", "alert");
        error.setAttribute("aria-live", "polite");
        const icon = document.createElement("span");
        icon.className = "gala-canvas-file-input-error-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "!";
        const message = document.createElement("span");
        message.textContent = CANVAS_FILE_INPUT_ERROR;
        error.replaceChildren(icon, message);

        const anchor = status || inputList;
        if (host && (error.parentElement !== host || (anchor && error.previousElementSibling !== anchor))) {
          if (anchor?.parentElement === host) anchor.insertAdjacentElement("afterend", error);
          else host.appendChild(error);
        }
      } else {
        error?.remove();
      }

      const runButton = node.querySelector(".gen-btn");
      if (!runButton) return;
      if (!runButton.dataset.galaFileInputBaseline) {
        runButton.dataset.galaFileInputBaseline = runButton.disabled ? "disabled" : "enabled";
      }
      if (unsupported) {
        runButton.dataset.galaFileInputBlocked = "true";
        runButton.disabled = true;
        runButton.title = CANVAS_FILE_INPUT_ERROR;
      } else if (runButton.dataset.galaFileInputBlocked === "true") {
        if (runButton.dataset.galaFileInputBaseline === "enabled"
          && runButton.dataset.galaMediaLimitBlocked !== "true") {
          runButton.disabled = false;
        }
        delete runButton.dataset.galaFileInputBlocked;
        if (runButton.title === CANVAS_FILE_INPUT_ERROR) runButton.removeAttribute("title");
      }
    });
  }

  function renderCanvasFileNode(node) {
    if (!node?.matches(".canvas-node.image-node[data-gala-canvas-file-node=\"true\"]")) return;
    if (node.dataset.galaCanvasPrototypeUpload === "true") {
      renderCanvasPrototypeUploadNode(node);
      return;
    }
    const body = node.querySelector(":scope > .node-body") || node.querySelector(".node-body");
    if (!body) return;

    const fileName = cleanText(node.dataset.galaCanvasFileName) || "\u672a\u547d\u540d\u6587\u4ef6";
    const existing = body.querySelector("[data-gala-canvas-file-card]");
    if (existing) {
      const name = existing.querySelector("[data-gala-canvas-file-name]");
      if (name) name.textContent = fileName;
    } else {
      const card = document.createElement("div");
      card.className = "gala-canvas-file-card";
      card.dataset.galaCanvasFileCard = "true";

      const icon = document.createElement("span");
      icon.className = "gala-canvas-file-card-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 3.5h8l4 4v13H6z\"></path><path d=\"M14 3.5v4h4\"></path><path d=\"M9 12h6M9 15.5h6\"></path></svg>";

      const name = document.createElement("span");
      name.className = "gala-canvas-file-card-name";
      name.dataset.galaCanvasFileName = "true";
      name.textContent = fileName;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "gala-canvas-file-card-remove";
      remove.textContent = "\u00d7";
      remove.setAttribute("aria-label", "\u5220\u9664\u6587\u4ef6");
      remove.title = "\u5220\u9664\u6587\u4ef6";
      remove.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const nodeId = canvasUploadNodeId(node);
        if (nodeId) canvasFileNodeStates.delete(nodeId);
        const deleteButton = node.querySelector(":scope > .node-head button");
        if (deleteButton) deleteButton.click();
        else {
          node.remove();
          scheduleApply();
        }
      });

      card.append(icon, name, remove);
      body.replaceChildren(card);
    }

    const title = node.querySelector(":scope > .node-head .node-title") || node.querySelector(".node-title");
    if (title) title.textContent = "\u6587\u4ef6";
  }

  function setupCanvasUploadSourceModal() {
    if (getRouteName() !== "canvas") return;
    const dialog = Array.from(document.querySelectorAll('[role="dialog"]'))
      .find((candidate) => /请选择上传来源|choose upload source/i.test(cleanText(candidate.textContent)));
    if (!dialog) return;
    dialog.querySelector('[data-gala-volc-upload-source="true"]')?.remove();
    dialog.classList.remove("gala-canvas-upload-source-dialog");
  }

  function setupCanvasUploadNodePrototype() {
    if (getRouteName() !== "canvas") return;
    const canvasInput = findCanvasUploadInput();
    if (canvasInput) {
      canvasInput.dataset.galaCanvasUploadInput = "true";
      canvasInput.accept = "*/*";
      canvasInput.multiple = true;
      bindCanvasUploadInput(canvasInput);
    }

    document.querySelectorAll(".canvas-node.image-node").forEach((node) => {
      const names = canvasFileNodeStates.get(canvasUploadNodeId(node));
      if (!names?.length) return;
      node.dataset.galaCanvasFileNode = "true";
      node.dataset.galaCanvasFileName = names.join(", ");
    });

    document.querySelectorAll(".canvas-node.image-node").forEach((node) => {
      const blank = node.querySelector(":scope > .node-body .blank-image") || node.querySelector(".blank-image");
      if (!blank) return;
      captureCanvasPrototypeUploadFrameSize(node);
      const title = node.querySelector(":scope > .node-head .node-title") || node.querySelector(".node-title");
      if (title) title.textContent = "上传图片/视频/音频/文件";
      const hint = blank.querySelector(":scope > div");
      if (hint) hint.textContent = "点击或拖拽上传图片/视频/音频/文件";
      blank.setAttribute("title", "点击或拖拽上传图片/视频/音频/文件");
    });
    document.querySelectorAll(".canvas-node-dock button").forEach((button) => {
      const text = cleanText(button.textContent);
      if (!/\u4e0a\u4f20/.test(text) || !/(\u56fe\u7247|\u89c6\u9891|\u7d20\u6750)/.test(text)) return;
      let replaced = false;
      Array.from(button.childNodes).forEach((child) => {
        if (child.nodeType !== Node.TEXT_NODE || !/\u4e0a\u4f20/.test(child.nodeValue || "")) return;
        child.nodeValue = CANVAS_UPLOAD_LABEL;
        replaced = true;
      });
      if (!replaced) {
        const label = Array.from(button.querySelectorAll("span"))
          .reverse()
          .find((span) => !span.querySelector("svg") && /\u4e0a\u4f20/.test(cleanText(span.textContent)));
        if (label) label.textContent = CANVAS_UPLOAD_LABEL;
      }
      button.setAttribute("aria-label", CANVAS_UPLOAD_LABEL);
      button.title = CANVAS_UPLOAD_LABEL;
    });

    document.querySelectorAll(".canvas-node.image-node").forEach((node) => {
      const blank = node.querySelector(":scope > .node-body .blank-image") || node.querySelector(".blank-image");
      const title = node.querySelector(":scope > .node-head .node-title") || node.querySelector(".node-title");
      const isUploadNode = Boolean(blank)
        || node.dataset.galaCanvasFileNode === "true"
        || /^(image|\u56fe\u7247|\u4e0a\u4f20)/i.test(cleanText(title?.textContent));
      if (!isUploadNode) return;
      const hasImageMedia = Boolean(
        node.classList.contains("has-image")
        || node.querySelector(":scope > .node-body img")
        || node.querySelector(":scope > .node-body video")
        || node.querySelector(":scope > .node-body [data-gala-canvas-uploaded-media]"),
      );
      if (title) title.textContent = !blank && hasImageMedia ? "IMAGE" : CANVAS_UPLOAD_LABEL;
      if (!blank) return;
      const hint = blank.querySelector(":scope > div");
      if (hint) hint.textContent = CANVAS_UPLOAD_HINT;
      blank.setAttribute("title", CANVAS_UPLOAD_HINT);
    });

    document.querySelectorAll('.canvas-node.image-node[data-gala-canvas-file-node="true"]')
      .forEach(renderCanvasFileNode);
    restoreCanvasPrototypeUploadNodes();
    document.querySelectorAll(".canvas-node.gala-canvas-prototype-upload")
      .forEach(renderCanvasPrototypeUploadNode);

    // Native image uploads can arrive after the prototype state has been
    // reconciled. Keep a filled image node semantic instead of leaving the
    // upload-slot label in its header.
    document.querySelectorAll(".canvas-node.image-node").forEach((node) => {
      if (canvasNodeHasUploadSlot(node)) return;
      const title = node.querySelector(":scope > .node-head .node-title") || node.querySelector(".node-title");
      const hasImageMedia = Boolean(
        node.classList.contains("has-image")
        || node.querySelector(":scope > .node-body img")
        || node.querySelector(":scope > .node-body video")
        || node.querySelector(":scope > .node-body [data-gala-canvas-uploaded-media]"),
      );
      if (!title || !hasImageMedia) return;
      const currentTitle = cleanText(title.textContent);
      if (/^(image|\u56fe\u7247|\u4e0a\u4f20\u56fe\u7247\/\u89c6\u9891\/\u97f3\u9891\/\u6587\u4ef6)$/i.test(currentTitle)) {
        title.textContent = "IMAGE";
      }
    });
  }

  function upgradeCanvasWan30Panel(panel, node, index) {
    if (!panel || panel.dataset.galaWan30PanelVersion === "3") return;
    panel.replaceChildren();
    panel.dataset.galaWan30PanelVersion = "3";

    const stateKey = node.dataset.canvasNodeId || node.dataset.id || `canvas-video-${index}`;
    panel.dataset.galaWan30StateKey = stateKey;
    const state = getWan30UrlState(stateKey);

    const urlCard = document.createElement("div");
    urlCard.className = "gala-canvas-wan30-panel-card gala-canvas-wan30-url-row";
    urlCard.dataset.galaWan30Source = "url";
    const urlTitle = document.createElement("strong");
    urlTitle.className = "gala-canvas-wan30-panel-card-title";
    urlTitle.textContent = "公网 URL";
    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.className = "gala-canvas-wan30-url-input";
    urlInput.placeholder = "https://example.com/video";
    urlInput.value = state.value;
    urlInput.setAttribute("aria-label", "\u516c\u7f51 URL");
    const urlHelper = document.createElement("span");
    urlHelper.className = "gala-canvas-wan30-url-helper";
    const urlError = document.createElement("span");
    urlError.className = "gala-canvas-wan30-url-error";
    urlError.setAttribute("role", "alert");
    urlError.hidden = true;
    urlError.textContent = "\u6587\u4ef6\u548c\u516c\u7f51\u7f51\u9875\u53ea\u80fd\u9009\u4e00\u4e2a\uff0c\u8bf7\u5148\u6e05\u7a7a URL \u6216\u65ad\u5f00\u6587\u4ef6\u8282\u70b9\u3002";
    urlHelper.textContent = "支持一个文档或一个公网网页，二者只能选一个。";
    const urlActions = document.createElement("div");
    urlActions.className = "gala-canvas-wan30-url-actions";
    const urlRemove = document.createElement("button");
    urlRemove.type = "button";
    urlRemove.className = "gala-canvas-wan30-url-remove";
    urlRemove.textContent = "清空";
    urlRemove.setAttribute("aria-label", "\u6e05\u7a7a URL");
    const urlConfirm = document.createElement("button");
    urlConfirm.type = "button";
    urlConfirm.className = "gala-canvas-wan30-url-confirm";
    urlConfirm.textContent = "确定";
    urlActions.append(urlRemove, urlConfirm);
    urlCard.append(urlTitle, urlInput, urlHelper, urlError, urlActions);

    const validateUrl = () => {
      const value = cleanText(urlInput.value);
      const hasConnectedFile = findCanvasFileConnections()
        .some(({ videoNode }) => videoNode === node);
      if (value && hasConnectedFile) {
        urlError.hidden = false;
        urlInput.classList.add("gala-canvas-wan30-url-input-error");
        urlInput.setCustomValidity("");
        return false;
      }
      urlError.hidden = true;
      urlInput.classList.remove("gala-canvas-wan30-url-input-error");
      if (value && !/^https?:\/\//i.test(value)) {
        urlInput.setCustomValidity("\u8bf7\u8f93\u5165 http:// \u6216 https:// \u5f00\u5934的 URL");
        urlInput.reportValidity();
        return false;
      }
      urlInput.setCustomValidity("");
      state.value = value;
      return true;
    };
    urlInput.addEventListener("input", () => {
      if (!cleanText(urlInput.value)) {
        urlError.hidden = true;
        urlInput.classList.remove("gala-canvas-wan30-url-input-error");
      }
    });
    urlInput.addEventListener("change", validateUrl);
    urlConfirm.addEventListener("click", validateUrl);
    urlRemove.addEventListener("click", () => {
      state.value = "";
      urlInput.value = "";
      urlError.hidden = true;
      urlInput.classList.remove("gala-canvas-wan30-url-input-error");
      urlInput.setCustomValidity("");
      urlInput.focus();
    });

    panel.append(urlCard);
  }

  function setupCanvasWan30Inputs() {
    const isCanvas = getRouteName() === "canvas";
    if (!isCanvas) return;

    const videoNodes = Array.from(document.querySelectorAll(".canvas-node.video-node"));
    videoNodes.forEach((node, index) => {
      const wan30 = isWan30CanvasVideoNode(node);
      node.querySelectorAll("[data-gala-media-limit-status], [data-gala-media-limit-error]")
        .forEach((element) => element.classList.remove("gala-canvas-wan30-hide-generic"));
      let panel = node.querySelector('[data-gala-wan30-canvas-panel="true"]');
      if (!wan30) {
        panel?.remove();
        return;
      }

      const body = node.querySelector(":scope > .node-body") || node.querySelector(".node-body");
      const inputList = node.querySelector(".video-img-list");
      const settings = body?.querySelector(":scope > .gen-settings") || body?.querySelector(".gen-settings");
      if (!body) return;

      if (!panel) {
        panel = document.createElement("div");
        panel.dataset.galaWan30CanvasPanel = "true";
        panel.className = "gala-canvas-wan30-panel";
        const heading = document.createElement("div");
        heading.className = "gala-canvas-wan30-panel-heading";
        heading.textContent = "wan3.0 输入";

        const fileRow = document.createElement("div");
        fileRow.className = "gala-canvas-wan30-panel-row";
        fileRow.dataset.galaWan30Source = "file";
        const fileLabel = document.createElement("span");
        fileLabel.className = "gala-canvas-wan30-panel-label";
        fileLabel.textContent = "文件";
        const fileStatus = document.createElement("span");
        fileStatus.className = "gala-canvas-wan30-panel-status";
        fileRow.append(fileLabel, fileStatus);

        const urlRow = document.createElement("div");
        urlRow.className = "gala-canvas-wan30-panel-row gala-canvas-wan30-url-row";
        urlRow.dataset.galaWan30Source = "url";
        const urlLabel = document.createElement("span");
        urlLabel.className = "gala-canvas-wan30-panel-label";
        urlLabel.textContent = "公网 URL";
        const urlInput = document.createElement("input");
        urlInput.type = "url";
        urlInput.className = "gala-canvas-wan30-url-input";
        urlInput.placeholder = "https://example.com/video";
        urlInput.setAttribute("aria-label", "\u516c\u7f51 URL");
        const urlRemove = document.createElement("button");
        urlRemove.type = "button";
        urlRemove.className = "gala-canvas-wan30-url-remove";
        urlRemove.textContent = "×";
        urlRemove.setAttribute("aria-label", "\u6e05\u7a7a URL");
        urlRow.append(urlLabel, urlInput, urlRemove);

        panel.append(heading, fileRow, urlRow);
        if (inputList?.parentElement) inputList.insertAdjacentElement("afterend", panel);
        else if (settings) body.insertBefore(panel, settings);
        else body.appendChild(panel);

        const stateKey = node.dataset.canvasNodeId || node.dataset.id || `canvas-video-${index}`;
        panel.dataset.galaWan30StateKey = stateKey;
        const state = getWan30UrlState(stateKey);
        urlInput.value = state.value;
        urlInput.addEventListener("input", () => {
          state.value = cleanText(urlInput.value);
        });
        urlInput.addEventListener("change", () => {
          const value = cleanText(urlInput.value);
          if (value && !/^https?:\/\//i.test(value)) {
            urlInput.setCustomValidity("\u8bf7\u8f93\u5165 http:// \u6216 https:// \u5f00\u5934\u7684 URL");
            urlInput.reportValidity();
            return;
          }
          urlInput.setCustomValidity("");
          state.value = value;
        });
        urlRemove.addEventListener("click", () => {
          state.value = "";
          urlInput.value = "";
          urlInput.setCustomValidity("");
          urlInput.focus();
        });
      }

      upgradeCanvasWan30Panel(panel, node, index);
      const fileConnected = Boolean(inputList?.querySelector(".video-input-item"));
      const fileStatus = panel.querySelector('[data-gala-wan30-source="file"] .gala-canvas-wan30-panel-status');
      const fileCount = panel.querySelector("[data-gala-wan30-file-count]");
      if (fileStatus) {
        fileStatus.textContent = fileConnected
          ? "\u5df2\u8fde\u63a5 1/1\uff08\u6765\u81ea\u4e0a\u4f20\u8282\u70b9\uff09"
          : "\u8fde\u63a5\u4e0a\u4f20\u8282\u70b9\u540e\u4f20\u5165\u6587\u4ef6";
        fileStatus.dataset.connected = fileConnected ? "true" : "false";
      }
      if (fileCount) fileCount.textContent = `文件 ${fileConnected ? 1 : 0}/1`;
      panel.dataset.fileConnected = fileConnected ? "true" : "false";
    });
  }

  function setupWan30VideoInput(context) {
    if (!context || context.config?.key !== "video" || !context.input) {
      closeWan30UrlPopover();
      return;
    }

    const tools = context.input.querySelector(".gala-prompt-tools");
    const row = tools?.querySelector(".gala-prompt-tools-row");
    const fileInput = tools?.querySelector(".gala-attachment-file-input");
    if (!tools || !row || !fileInput) return;

    let summary = tools.querySelector(".gala-wan30-input-summary");
    if (!summary) {
      summary = document.createElement("div");
      summary.className = "gala-wan30-input-summary";
      summary.hidden = true;
      tools.appendChild(summary);
    }

    let button = row.querySelector('[data-gala-prompt-action="url"]');
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.galaPromptAction = "url";
      row.insertBefore(button, row.querySelector('[data-gala-prompt-action="mention"]') || row.firstChild);
    }
    button.className = "gala-prompt-tool-button gala-prompt-tool-button--symbol";
    button.textContent = "";
    button.setAttribute("aria-label", "\u6dfb\u52a0\u516c\u7f51 URL");
    button.title = "\u6dfb\u52a0\u516c\u7f51 URL";

    const wan30 = isWan30VideoContext(context);
    fileInput.multiple = !wan30;
    fileInput.accept = wan30 ? "image/*,video/*" : "image/*,video/*,audio/*,.pdf,.txt";
    button.hidden = !wan30;
    summary.hidden = !wan30;

    if (!button.dataset.galaEventsBound) {
      button.dataset.galaEventsBound = "true";
      button.addEventListener("click", () => {
        const currentContext = findPageContext() || context;
        if (!isWan30VideoContext(currentContext)) return;
        openWan30UrlPopover(currentContext, button, () => {
          const latestContext = findPageContext() || currentContext;
          renderWan30PromptSummary(latestContext, latestContext.input?.querySelector(".gala-prompt-tools"));
        });
      });
    }

    if (!fileInput.dataset.galaWan30GuardBound) {
      fileInput.dataset.galaWan30GuardBound = "true";
      fileInput.addEventListener("change", (event) => {
        const currentContext = findPageContext() || context;
        if (!isWan30VideoContext(currentContext)) return;
        event.stopImmediatePropagation();
        const files = Array.from(fileInput.files || []);
        const list = getAttachmentList(currentContext.config.key);
        const capacity = Math.max(0, 1 - list.length);
        const acceptedFiles = files.slice(0, capacity);
        acceptedFiles.forEach((file) => {
          if (!list.some((existing) => attachmentKey(existing) === attachmentKey(file))) list.push(file);
         });
         const currentTools = currentContext.input?.querySelector(".gala-prompt-tools");
        const currentStrip = currentTools?.querySelector(".gala-attachment-strip");
        startAttachmentUpload(currentContext, acceptedFiles, currentStrip);
         if (currentTools) {
          currentTools.dataset.galaWan30Notice = files.length > acceptedFiles.length
            ? "wan3.0 \u6700\u591a\u4e0a\u4f20 1 \u4e2a\u6587\u4ef6"
            : "";
          renderAttachments(currentContext, currentStrip);
          renderWan30PromptSummary(currentContext, currentTools);
          if (files.length > acceptedFiles.length) {
            window.setTimeout(() => {
              if (currentTools.isConnected) {
                currentTools.dataset.galaWan30Notice = "";
                renderWan30PromptSummary(currentContext, currentTools);
              }
            }, 3200);
          }
        }
        syncReferenceInputs(currentContext, acceptedFiles);
        schedulePromptResize(currentContext, getPromptEditor(currentContext));
        fileInput.value = "";
      }, true);
    }

    const list = getAttachmentList(context.config.key);
    if (wan30 && list.length > 1) {
      list.splice(1);
      renderAttachments(context, tools.querySelector(".gala-attachment-strip"));
    }
    renderWan30PromptSummary(context, tools);
  }

  function setupPrompt(context) {
    if (!context.config.prompt || !context.input) return;
    const scope = context.inputScroll || context.input;
    const wrapper = scope.querySelector(".online-prompt-editor-input") || scope.querySelector(".prompt-variable-textarea");
    if (!wrapper) return;

    const editor = getPromptEditor(context);
    const promptSection = findPromptSection(context, wrapper);
    context.promptWrapper = wrapper;
    context.promptSection = promptSection;

    if (promptSection) {
      setSectionHeading(promptSection, /prompt|提示词|^01\./i, "01. 输入");
      hideNativePromptActions(promptSection);
    }

    const sections = Array.from(scope.querySelectorAll("section"));
    hideReferenceSections(context, sections);
    const parameterSection = sections.find((section) => /参数|模型/.test(cleanText(section.textContent)));
    if (parameterSection) setSectionHeading(parameterSection, /参数|^0[34]\./, "02. 参数");

    ensurePromptTools(context, wrapper, editor);
    hidePromptAssistOverlays();
    if (editor) bindPromptResize(context, editor);
  }

  function formatTaskTime(value) {
    if (!value || typeof value === "boolean") return "刚刚";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "刚刚";
    return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function taskLabel(task) {
    const raw = task.raw || {};
    return cleanText(raw.prompt || raw.input_prompt || raw.description || raw.name || raw.task_type || raw.type || `任务 ${task.id}`).slice(0, 150);
  }

  function taskStatusLabel(task) {
    if (task.category === "success") return "成功";
    if (task.category === "failed") return "失败";
    return "进行中";
  }

  function createTaskSummary(text) {
    const element = document.createElement("span");
    element.textContent = text;
    return element;
  }

  function ensureTaskModal() {
    if (taskModal) return taskModal;

    const backdrop = document.createElement("div");
    backdrop.className = "gala-task-modal-backdrop";
    backdrop.hidden = true;
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeTaskModal();
    });

    const dialog = document.createElement("section");
    dialog.className = "gala-task-modal";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "gala-task-modal-title");

    const header = document.createElement("header");
    header.className = "gala-task-modal-header";
    const title = document.createElement("div");
    title.className = "gala-task-modal-title";
    title.id = "gala-task-modal-title";
    title.textContent = "任务详情";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "gala-task-modal-close";
    close.setAttribute("aria-label", "关闭任务详情");
    close.textContent = "×";
    close.addEventListener("click", closeTaskModal);
    header.append(title, close);

    const summary = document.createElement("div");
    summary.className = "gala-task-modal-summary";
    const list = document.createElement("div");
    list.className = "gala-task-modal-list";
    dialog.append(header, summary, list);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    taskModal = { backdrop, dialog, summary, list };
    return taskModal;
  }

  function renderTaskModal(context) {
    if (!taskModal || !context) return;
    const state = getTaskState(context.config.endpoint);
    taskModal.summary.replaceChildren(
      createTaskSummary(`${context.config.title} · 共 ${state.tasks.size} 个任务`),
      createTaskSummary(`进行中 ${countRunningTasks(context, state)}`),
      createTaskSummary(`成功 ${state.success}`),
      createTaskSummary(`失败 ${state.failed}`),
    );
    taskModal.list.replaceChildren();

    const tasks = Array.from(state.tasks.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    if (!tasks.length) {
      const empty = document.createElement("div");
      empty.className = "gala-task-modal-empty";
      empty.textContent = "当前页面暂无个人任务";
      taskModal.list.appendChild(empty);
      return;
    }

    tasks.forEach((task) => {
      const item = document.createElement("article");
      item.className = "gala-task-modal-item";
      const top = document.createElement("div");
      top.className = "gala-task-modal-item-top";
      const label = document.createElement("div");
      label.className = "gala-task-modal-item-label";
      label.title = taskLabel(task);
      label.textContent = taskLabel(task);
      const status = document.createElement("span");
      status.className = `gala-task-status gala-task-status--${task.category}`;
      status.textContent = taskStatusLabel(task);
      top.append(label, status);
      const meta = document.createElement("div");
      meta.className = "gala-task-modal-item-meta";
      meta.textContent = `任务 ID：${task.id} · ${formatTaskTime(task.updatedAt)}`;
      item.append(top, meta);
      taskModal.list.appendChild(item);
    });
  }

  async function openTaskModal(context) {
    if (!context) return;
    const modal = ensureTaskModal();
    activeContext = context;
    modal.backdrop.hidden = false;
    document.body.classList.add("gala-task-modal-open");
    renderTaskModal(context);

    const fetcher = nativeFetch || window.__galaNativeFetch || window.fetch.bind(window);
    try {
      const response = await fetcher(context.config.endpoint, { credentials: "same-origin" });
      if (response.ok) {
        const payload = await response.json();
        ingestTasks(context.config.endpoint, payload, "GET");
        renderTaskModal(context);
      }
    } catch (_error) {
      // The in-memory session list remains available if the endpoint is
      // unavailable while the details panel is open.
    }
  }

  function closeTaskModal() {
    if (!taskModal) return;
    taskModal.backdrop.hidden = true;
    document.body.classList.remove("gala-task-modal-open");
  }

  function workflowCardIsActive(card) {
    return card.classList.contains("active")
      || card.getAttribute("aria-selected") === "true"
      || card.dataset.selected === "true";
  }

  function workflowPreviewSignature(source) {
    if (!source) return "";
    const html = source.innerHTML || "";
    let hash = 0;
    for (let index = 0; index < html.length; index += 32) {
      hash = ((hash << 5) - hash + html.charCodeAt(index)) | 0;
    }
    return `${html.length}:${hash}:${source.textContent.length}`;
  }

  function ensureWorkflowCardPreview(card) {
    let slot = card.querySelector(":scope > .gala-workflow-card-preview");
    if (slot) return slot;

    slot = document.createElement("div");
    slot.className = "gala-workflow-card-preview";
    const label = document.createElement("span");
    label.className = "gala-workflow-card-preview-label";
    label.textContent = "画布预览";
    const stage = document.createElement("div");
    stage.className = "gala-workflow-card-preview-stage";
    slot.append(label, stage);
    card.appendChild(slot);
    return slot;
  }

  function renderWorkflowCardPreview(slot, source, signature, active) {
    const stage = slot.querySelector(".gala-workflow-card-preview-stage");
    if (!stage) return;

    if (!active || !source) {
      if (!active && stage.querySelector(".gala-workflow-card-preview-clone")) return;
      if (stage.dataset.galaPreviewState === "empty") return;
      const empty = document.createElement("div");
      empty.className = "gala-workflow-card-preview-empty";
      empty.textContent = active ? "暂无结构预览" : "选择工作流查看画布";
      stage.replaceChildren(empty);
      stage.dataset.galaPreviewState = "empty";
      return;
    }

    if (stage.dataset.galaPreviewState === signature) return;
    const clone = source.cloneNode(true);
    clone.classList.add("gala-workflow-card-preview-clone");
    clone.querySelector(".workflow-preview-expand-button")?.remove();
    stage.replaceChildren(clone);
    stage.dataset.galaPreviewState = signature;
  }

  function setupWorkflowLibraryLayout() {
    const root = Array.from(document.querySelectorAll(".asset-manager-root.template-workbench"))
      .find((node) => node.querySelector(".workflow-template-list, .workflow-list"));
    if (!root) return;

    // The template workbench already owns the original three-column layout.
    // Remove the temporary two-pane class and any preview slots that may have
    // been injected by an earlier version of this enhancement.
    root.classList.remove("gala-workflow-two-pane", "gala-workflow-manage-on");
    root.querySelectorAll(".gala-workflow-card-preview").forEach((slot) => slot.remove());
  }

  function setupWorkflowDetailActions() {
    document.querySelectorAll(".asset-manager-root.template-workbench > .asset-detail").forEach((detail) => {
      const titleRow = detail.querySelector(".detail-body > .dtitle");
      const favorite = titleRow?.querySelector(":scope > .favorite-btn");
      const panelActions = detail.querySelector(":scope > .panel-head > .panel-actions");
      const applyButton = panelActions
        ? Array.from(panelActions.querySelectorAll(":scope > button"))
            .find((button) => cleanText(button.textContent).startsWith("应用到画布"))
        : null;
      const proxy = titleRow?.querySelector(":scope > .gala-workflow-apply-button");

      if (!titleRow || !favorite || !panelActions || !applyButton) {
        proxy?.remove();
        return;
      }

      applyButton.classList.add("gala-workflow-apply-original");
      applyButton.dataset.galaWorkflowApplyOriginal = "true";

      let applyProxy = proxy;
      if (!applyProxy) {
        applyProxy = applyButton.cloneNode(true);
        applyProxy.classList.add("gala-workflow-apply-button");
        applyProxy.dataset.galaWorkflowApplyButton = "true";
        titleRow.insertBefore(applyProxy, favorite);
      }

      if (applyProxy.__galaWorkflowApplyOriginal !== applyButton) {
        if (applyProxy.__galaWorkflowApplyHandler) {
          applyProxy.removeEventListener("click", applyProxy.__galaWorkflowApplyHandler);
        }
        const handler = (event) => {
          event.preventDefault();
          event.stopPropagation();
          applyButton.click();
        };
        applyProxy.__galaWorkflowApplyOriginal = applyButton;
        applyProxy.__galaWorkflowApplyHandler = handler;
        applyProxy.addEventListener("click", handler);
      }

      applyProxy.disabled = applyButton.disabled;
      applyProxy.setAttribute("aria-disabled", String(applyButton.disabled));
      if (applyButton.title) applyProxy.title = applyButton.title;
    });
  }

  function findAdminSidebar() {
    return Array.from(document.querySelectorAll("aside")).find((sidebar) =>
      Array.from(sidebar.querySelectorAll("button")).some((button) => cleanText(button.textContent) === "API 设置"),
    );
  }

  function accountPermissionsWorkspace(sidebar) {
    const shell = sidebar?.parentElement;
    return shell
      ? Array.from(shell.children).find((child) => child.tagName === "SECTION")
      : null;
  }

  function setAccountPermissionsPageOpen(sidebar, open) {
    const workspace = accountPermissionsWorkspace(sidebar);
    const page = workspace?.querySelector(":scope > .gala-account-permissions-page");
    const navButton = sidebar?.querySelector("[data-gala-account-permissions-nav]");
    if (!workspace || !page) return;

    workspace.classList.toggle("gala-account-permissions-open", open);
    page.hidden = !open;
    navButton?.classList.toggle("gala-account-nav-active", open);
    if (open) navButton?.setAttribute("aria-current", "page");
    else navButton?.removeAttribute("aria-current");
  }

  function showAccountPermissionsToast(page, message) {
    const toast = page.querySelector("[data-account-toast]");
    if (!toast) return;
    let copy = toast.querySelector("[data-gala-toast-copy]");
    if (!copy) {
      copy = document.createElement("span");
      copy.dataset.galaToastCopy = "true";
      toast.appendChild(copy);
    }
    copy.textContent = message;
    toast.hidden = false;
    window.clearTimeout(page.__galaAccountToastTimer);
    page.__galaAccountToastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2200);
  }

  function updateAccountPermissionSummary(page) {
    const rows = Array.from(page.querySelectorAll("[data-account-row]"));
    const active = rows.filter((row) => row.dataset.status === "active").length;
    const disabled = rows.length - active;
    const visible = rows.filter((row) => !row.hidden).length;
    page.querySelector('[data-account-metric="total"]')?.replaceChildren(String(rows.length));
    page.querySelector('[data-account-metric="active"]')?.replaceChildren(String(active));
    page.querySelector('[data-account-metric="disabled"]')?.replaceChildren(String(disabled));
    page.querySelector('[data-account-result-count]')?.replaceChildren(`${visible} 个账号`);
  }

  function bindAccountPermissionsPage(page) {
    if (page.dataset.galaAccountPageBound === "true") return;
    page.dataset.galaAccountPageBound = "true";

    const search = page.querySelector("[data-account-search]");
    const filter = page.querySelector("[data-account-filter]");
    const rows = () => Array.from(page.querySelectorAll("[data-account-row]"));

    const refresh = () => {
      const query = cleanText(search?.value).toLowerCase();
      const statusFilter = filter?.value || "all";
      rows().forEach((row) => {
        const matchesQuery = !query || cleanText(row.dataset.search).toLowerCase().includes(query);
        const matchesStatus = statusFilter === "all" || row.dataset.status === statusFilter;
        row.hidden = !(matchesQuery && matchesStatus);
      });
      updateAccountPermissionSummary(page);
    };

    search?.addEventListener("input", refresh);
    filter?.addEventListener("change", refresh);
    page.querySelector("[data-account-add]")?.addEventListener("click", () => {
      showAccountPermissionsToast(page, "新增账号流程将在后续版本开放");
    });
    page.querySelector("[data-account-export]")?.addEventListener("click", () => {
      showAccountPermissionsToast(page, "账号列表已准备导出");
    });
    page.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const toggle = target?.closest("[data-account-toggle]");
      if (!toggle || !page.contains(toggle)) return;

      const row = toggle.closest("[data-account-row]");
      if (!row) return;
      const nextStatus = row.dataset.status === "active" ? "disabled" : "active";
      const enabled = nextStatus === "active";
      row.dataset.status = nextStatus;
      const status = row.querySelector("[data-account-status]");
      status?.classList.toggle("is-active", enabled);
      status?.classList.toggle("is-disabled", !enabled);
      if (status) status.textContent = enabled ? "已启用" : "已停用";
      toggle.textContent = enabled ? "停用" : "启用";
      toggle.classList.toggle("is-enable", !enabled);
      showAccountPermissionsToast(page, enabled ? "账号已重新启用" : "账号已停用");
      refresh();
    });

    refresh();
  }

  function renderAccountPermissionsPage(page) {
    if (page.dataset.galaAccountPageRendered === "true") return;
    page.dataset.galaAccountPageRendered = "true";
    page.innerHTML = `
      <div class="gala-account-page-inner">
        <header class="gala-account-page-header">
          <div>
            <div class="gala-account-eyebrow">ADMIN CONSOLE</div>
            <h1>账号权限管理</h1>
            <p>管理外包、兼职及协作账号的访问权限，确保账号按需使用。</p>
          </div>
          <div class="gala-account-header-actions">
            <span class="gala-account-admin-badge">管理员模式</span>
            <button type="button" class="gala-account-primary-btn" data-account-add>+ 新增账号</button>
          </div>
        </header>

        <section class="gala-account-summary-grid" aria-label="账号概览">
          <article class="gala-account-summary-card">
            <span>账号总数</span>
            <strong data-account-metric="total">4</strong>
            <small>含外包与兼职账号</small>
          </article>
          <article class="gala-account-summary-card is-green">
            <span>已启用</span>
            <strong data-account-metric="active">3</strong>
            <small>当前可正常登录</small>
          </article>
          <article class="gala-account-summary-card is-amber">
            <span>已停用</span>
            <strong data-account-metric="disabled">1</strong>
            <small>已暂停访问权限</small>
          </article>
          <article class="gala-account-summary-card is-blue">
            <span>权限角色</span>
            <strong>4</strong>
            <small>按岗位分配权限</small>
          </article>
        </section>

        <section class="gala-account-panel">
          <div class="gala-account-panel-heading">
            <div>
              <h2>账号列表</h2>
              <span data-account-result-count>4 个账号</span>
            </div>
            <span class="gala-account-panel-note">仅管理员可操作</span>
          </div>
          <div class="gala-account-toolbar">
            <label class="gala-account-search">
              <span aria-hidden="true">⌕</span>
              <input type="search" data-account-search placeholder="搜索姓名、邮箱或账号" />
            </label>
            <select class="gala-account-filter" data-account-filter aria-label="账号状态">
              <option value="all">全部状态</option>
              <option value="active">已启用</option>
              <option value="disabled">已停用</option>
            </select>
            <button type="button" class="gala-account-secondary-btn" data-account-export>导出列表</button>
          </div>

          <div class="gala-account-table" role="table" aria-label="账号权限列表">
            <div class="gala-account-table-head" role="row">
              <span>账号</span><span>类型</span><span>角色</span><span>权限范围</span><span>状态</span><span>操作</span>
            </div>
            <div class="gala-account-table-row" data-account-row data-status="active" data-search="林晓雯 lin.xw@gala.local 外包 视觉设计 资产库 提示词库">
              <div class="gala-account-person"><span class="gala-account-avatar is-purple">林</span><span><strong>林晓雯</strong><small>lin.xw@gala.local</small></span></div>
              <span class="gala-account-type">外包</span>
              <strong class="gala-account-role">视觉设计</strong>
              <div class="gala-account-permissions"><span>资产库</span><span>提示词库</span></div>
              <span class="gala-account-status is-active" data-account-status>已启用</span>
              <button type="button" class="gala-account-row-btn" data-account-toggle>停用</button>
            </div>
            <div class="gala-account-table-row" data-account-row data-status="active" data-search="陈宇航 chen.yh@gala.local 兼职 运营协作 在线生图 资产库">
              <div class="gala-account-person"><span class="gala-account-avatar is-blue">陈</span><span><strong>陈宇航</strong><small>chen.yh@gala.local</small></span></div>
              <span class="gala-account-type">兼职</span>
              <strong class="gala-account-role">运营协作</strong>
              <div class="gala-account-permissions"><span>在线生图</span><span>资产库</span></div>
              <span class="gala-account-status is-active" data-account-status>已启用</span>
              <button type="button" class="gala-account-row-btn" data-account-toggle>停用</button>
            </div>
            <div class="gala-account-table-row" data-account-row data-status="active" data-search="周子涵 zhou.zh@gala.local 外包 视频剪辑 在线生视频 资产库">
              <div class="gala-account-person"><span class="gala-account-avatar is-orange">周</span><span><strong>周子涵</strong><small>zhou.zh@gala.local</small></span></div>
              <span class="gala-account-type">外包</span>
              <strong class="gala-account-role">视频剪辑</strong>
              <div class="gala-account-permissions"><span>在线生视频</span><span>资产库</span></div>
              <span class="gala-account-status is-active" data-account-status>已启用</span>
              <button type="button" class="gala-account-row-btn" data-account-toggle>停用</button>
            </div>
            <div class="gala-account-table-row" data-account-row data-status="disabled" data-search="王可 wang.ke@gala.local 临时协作者 只读 工作流模板库">
              <div class="gala-account-person"><span class="gala-account-avatar is-gray">王</span><span><strong>王可</strong><small>wang.ke@gala.local</small></span></div>
              <span class="gala-account-type">临时协作者</span>
              <strong class="gala-account-role">只读协作者</strong>
              <div class="gala-account-permissions"><span>工作流模板库</span></div>
              <span class="gala-account-status is-disabled" data-account-status>已停用</span>
              <button type="button" class="gala-account-row-btn is-enable" data-account-toggle>启用</button>
            </div>
          </div>

          <div class="gala-account-help"><span aria-hidden="true">i</span><p>停用账号后，该账号将无法登录，已创建的模板、资产和历史记录不会被删除。</p></div>
        </section>
      </div>
      <div class="gala-account-toast" data-account-toast role="status" aria-live="polite" hidden>
        <span data-gala-toast-copy></span>
      </div>
    `;
    bindAccountPermissionsPage(page);
  }

  function bindSimpleAccountPermissionsPage(page) {
    if (page.dataset.galaAccountSimpleBound === "true") return;
    page.dataset.galaAccountSimpleBound = "true";
    const search = page.querySelector("[data-account-simple-search]");
    const rows = () => Array.from(page.querySelectorAll("[data-account-row]"));
    const refresh = () => {
      const query = cleanText(search?.value).toLowerCase();
      rows().forEach((row) => {
        row.hidden = Boolean(query) && !cleanText(row.dataset.search).toLowerCase().includes(query);
      });
    };
    search?.addEventListener("input", refresh);
    page.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const toggle = target?.closest("[data-account-toggle]");
      if (!toggle || !page.contains(toggle)) return;
      const row = toggle.closest("[data-account-row]");
      if (!row) return;

      const enabled = row.dataset.status !== "active";
      row.dataset.status = enabled ? "active" : "disabled";
      const status = row.querySelector("[data-account-status]");
      status?.classList.toggle("is-active", enabled);
      status?.classList.toggle("is-disabled", !enabled);
      if (status) status.textContent = enabled ? "已启用" : "已停用";
      toggle.textContent = enabled ? "停用" : "启用";
      toggle.classList.toggle("is-enable", !enabled);
    });
    refresh();
  }

  function renderSimpleAccountPermissionsPage(page) {
    if (page.dataset.galaAccountSimpleRendered === "true") return;
    page.dataset.galaAccountSimpleRendered = "true";
    page.innerHTML = `
      <div class="gala-account-page-inner">
        <header class="gala-account-page-header">
          <div>
            <h1>账号权限管理</h1>
            <p>管理外包、兼职等账号的启用状态。</p>
          </div>
        </header>

        <section class="gala-account-panel">
          <div class="gala-account-panel-heading">
            <div>
              <h2>账号列表</h2>
            </div>
          </div>
          <div class="gala-account-toolbar">
            <label class="gala-account-search">
              <span aria-hidden="true">⌕</span>
              <input type="search" data-account-simple-search placeholder="搜索账号名或姓名" />
            </label>
          </div>
          <div class="gala-account-table" role="table" aria-label="账号状态列表">
            <div class="gala-account-table-head" role="row">
              <span>账号名</span><span>姓名</span><span>当前状态</span><span>操作</span>
            </div>
            <div class="gala-account-table-row" data-account-row data-status="active" data-search="lin.xw 林晓雯">
              <strong class="gala-account-username">lin.xw</strong>
              <span class="gala-account-real-name">林晓雯</span>
              <span class="gala-account-status is-active" data-account-status>已启用</span>
              <button type="button" class="gala-account-row-btn" data-account-toggle>停用</button>
            </div>
            <div class="gala-account-table-row" data-account-row data-status="active" data-search="chen.yh 陈宇航">
              <strong class="gala-account-username">chen.yh</strong>
              <span class="gala-account-real-name">陈宇航</span>
              <span class="gala-account-status is-active" data-account-status>已启用</span>
              <button type="button" class="gala-account-row-btn" data-account-toggle>停用</button>
            </div>
            <div class="gala-account-table-row" data-account-row data-status="active" data-search="zhou.zh 周子涵">
              <strong class="gala-account-username">zhou.zh</strong>
              <span class="gala-account-real-name">周子涵</span>
              <span class="gala-account-status is-active" data-account-status>已启用</span>
              <button type="button" class="gala-account-row-btn" data-account-toggle>停用</button>
            </div>
            <div class="gala-account-table-row" data-account-row data-status="disabled" data-search="wang.ke 王可">
              <strong class="gala-account-username">wang.ke</strong>
              <span class="gala-account-real-name">王可</span>
              <span class="gala-account-status is-disabled" data-account-status>已停用</span>
              <button type="button" class="gala-account-row-btn is-enable" data-account-toggle>启用</button>
            </div>
          </div>
        </section>
      </div>
    `;
    bindSimpleAccountPermissionsPage(page);
  }

  function installAccountPermissionsDismiss() {
    if (window.__galaAccountPermissionsDismissInstalled) return;
    window.__galaAccountPermissionsDismissInstalled = true;
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const sidebar = findAdminSidebar();
      if (!target || !sidebar?.contains(target)) return;
      if (target.closest("[data-gala-account-permissions-nav]")) return;
      if (target.closest("button")) setAccountPermissionsPageOpen(sidebar, false);
    }, true);
  }

  function setupAccountPermissionsPrototype() {
    const sidebar = findAdminSidebar();
    if (!sidebar) return;
    const apiButton = Array.from(sidebar.querySelectorAll("button"))
      .find((button) => cleanText(button.textContent) === "API 设置");
    const workspace = accountPermissionsWorkspace(sidebar);
    if (!apiButton || !workspace) return;

    let navButton = sidebar.querySelector("[data-gala-account-permissions-nav]");
    if (!navButton) {
      navButton = apiButton.cloneNode(true);
      navButton.dataset.galaAccountPermissionsNav = "true";
      navButton.title = "账号权限管理";
      navButton.removeAttribute("aria-current");
      const label = navButton.querySelector("span");
      if (label) label.textContent = "账号权限";
      const icon = navButton.querySelector("svg");
      if (icon) {
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.innerHTML = '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="7" r="3"/><path d="M16 8h4M18 6v4"/>';
      }
      navButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setAccountPermissionsPageOpen(findAdminSidebar(), true);
      });
      apiButton.parentElement?.insertBefore(navButton, apiButton);
    }

    const active = workspace.classList.contains("gala-account-permissions-open");
    navButton.className = apiButton.className;
    navButton.classList.add("gala-account-permissions-nav");
    navButton.classList.remove("bg-foreground", "text-background", "hover:bg-foreground", "hover:text-background", "border-foreground");
    navButton.classList.add("bg-transparent", "text-muted-foreground", "hover:bg-accent/10", "hover:text-foreground");
    const sourceLabel = apiButton.querySelector(":scope > span");
    const navLabel = navButton.querySelector(":scope > span");
    if (sourceLabel && navLabel) navLabel.className = sourceLabel.className;
    navButton.classList.toggle("gala-account-nav-active", active);
    if (active) navButton.setAttribute("aria-current", "page");
    else navButton.removeAttribute("aria-current");

    let page = workspace.querySelector(":scope > .gala-account-permissions-page");
    if (!page) {
      page = document.createElement("div");
      page.className = "gala-account-permissions-page";
      page.hidden = true;
      workspace.appendChild(page);
      renderSimpleAccountPermissionsPage(page);
    }
    installAccountPermissionsDismiss();
  }

  function enhanceMultiUploadFileKey(file) {
    return [file.name, file.size, file.lastModified].join("::");
  }

  function releaseEnhanceMultiUploadItems(items) {
    items.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
  }

  function setEnhanceMultiUploadItems(files) {
    const previous = new Map(enhanceMultiUploadItems.map((item) => [item.key, item]));
    const next = [];
    let limitExceeded = false;
    Array.from(files || []).forEach((file) => {
      if (!file?.type?.startsWith("image/")) return;
      const key = enhanceMultiUploadFileKey(file);
      if (next.some((item) => item.key === key)) return;
      if (next.length >= 9) {
        limitExceeded = true;
        return;
      }
      next.push(previous.get(key) || {
        file,
        key,
        url: URL.createObjectURL(file),
      });
    });

    const keep = new Set(next.map((item) => item.key));
    releaseEnhanceMultiUploadItems(enhanceMultiUploadItems.filter((item) => !keep.has(item.key)));
    enhanceMultiUploadItems = next;
    enhanceMultiUploadLimitNotice = limitExceeded ? "最多支持 9 张，超出图片未添加" : "";
  }

  function appendEnhanceMultiUploadFiles(files) {
    if (Array.from(files || []).some((file) => file?.type?.startsWith("image/"))) {
      enhanceMultiUploadStarted = true;
    }
    setEnhanceMultiUploadItems([
      ...enhanceMultiUploadItems.map((item) => item.file),
      ...Array.from(files || []),
    ]);
  }

  function clearEnhanceMultiUploadItems() {
    releaseEnhanceMultiUploadItems(enhanceMultiUploadItems);
    enhanceMultiUploadItems = [];
    enhanceMultiUploadLimitNotice = "";
    enhanceMultiUploadStarted = false;
  }

  function enhanceMultiUploadHint(source, isVideo) {
    const hint = Array.from(source.querySelectorAll("p")).find((node) => {
      const text = cleanText(node.textContent);
      return text.includes("点击选择") || text.includes("Click to browse");
    });
    if (!hint || isVideo) return;
    hint.textContent = hint.textContent.includes("Click")
      ? "Click to browse or drag multiple images"
      : "点击选择或拖拽多张图片";
  }

  function renderEnhanceMultiUpload(source, input, dropzone) {
    const isVideo = (input.accept || "").includes("video");
    if (isVideo) {
      clearEnhanceMultiUploadItems();
      source.classList.remove("gala-multi-upload-source");
      source.querySelectorAll("[data-gala-multi-upload-card]").forEach((card) => card.remove());
      dropzone?.style.removeProperty("display");
      return;
    }

    source.classList.add("gala-multi-upload-source");
    enhanceMultiUploadHint(source, false);
    if (!enhanceMultiUploadStarted || !dropzone) {
      source.querySelectorAll("[data-gala-multi-upload-card]").forEach((card) => card.remove());
      dropzone?.style.removeProperty("display");
      return;
    }

    dropzone.style.display = "none";
    let card = source.querySelector("[data-gala-multi-upload-card]");
    if (!card) {
      card = document.createElement("div");
      card.className = "gala-multi-upload-card";
      card.dataset.galaMultiUploadCard = "true";
      card.innerHTML = `
        <div class="gala-multi-upload-head">
          <div><strong data-gala-multi-upload-count></strong><span>可继续添加图片</span></div>
          <button type="button" data-gala-multi-upload-add>继续添加</button>
        </div>
        <div class="gala-multi-upload-grid" data-gala-multi-upload-grid></div>
        <div class="gala-multi-upload-footnote" data-gala-multi-upload-footnote></div>
      `;
      source.appendChild(card);
    }

    card.__galaEnhanceInput = input;
    if (!card.dataset.galaMultiUploadBound) {
      card.dataset.galaMultiUploadBound = "true";
      card.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const currentInput = card.__galaEnhanceInput;
        if (!target || !currentInput) return;

        const remove = target.closest("[data-gala-multi-upload-remove]");
        if (remove) {
          event.preventDefault();
          event.stopPropagation();
          const key = remove.dataset.galaMultiUploadRemove;
          const item = enhanceMultiUploadItems.find((entry) => entry.key === key);
          if (item?.url) URL.revokeObjectURL(item.url);
          enhanceMultiUploadItems = enhanceMultiUploadItems.filter((entry) => entry.key !== key);
          enhanceMultiUploadLimitNotice = "";
          renderEnhanceMultiUpload(source, currentInput, currentInput.parentElement);
          return;
        }

        if (target.closest("[data-gala-multi-upload-add]")) {
          event.preventDefault();
          currentInput.value = "";
          currentInput.click();
        }
      });
      card.addEventListener("dragover", (event) => event.preventDefault());
      card.addEventListener("drop", (event) => {
        event.preventDefault();
        const files = event.dataTransfer?.files;
        if (!files?.length) return;
        appendEnhanceMultiUploadFiles(files);
        renderEnhanceMultiUpload(source, card.__galaEnhanceInput, card.__galaEnhanceInput?.parentElement);
      });
    }

    const count = card.querySelector("[data-gala-multi-upload-count]");
    const footnote = card.querySelector("[data-gala-multi-upload-footnote]");
    const grid = card.querySelector("[data-gala-multi-upload-grid]");
    if (count) {
      count.textContent = enhanceMultiUploadItems.length
        ? `已选择 ${enhanceMultiUploadItems.length} 张图片`
        : "尚未选择图片";
    }
    if (footnote) {
      footnote.textContent = enhanceMultiUploadLimitNotice || (
        enhanceMultiUploadItems.length ? "支持 JPG、PNG、WEBP，最多 9 张" : "点击“继续添加”选择图片"
      );
    }
    if (!grid) return;
    grid.replaceChildren();

    enhanceMultiUploadItems.forEach((item) => {
      const figure = document.createElement("figure");
      figure.className = "gala-multi-upload-item";
      const image = document.createElement("img");
      image.src = item.url;
      image.alt = item.file.name;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "gala-multi-upload-remove";
      remove.dataset.galaMultiUploadRemove = item.key;
      remove.setAttribute("aria-label", `移除 ${item.file.name}`);
      remove.textContent = "×";
      const caption = document.createElement("figcaption");
      caption.textContent = item.file.name;
      figure.append(image, remove, caption);
      grid.appendChild(figure);
    });

    if (enhanceMultiUploadItems.length < 9) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "gala-multi-upload-add-tile";
      add.dataset.galaMultiUploadAdd = "true";
      add.innerHTML = "<strong>+</strong><span>继续添加</span>";
      grid.appendChild(add);
    }
  }

  function setupEnhanceMultiUpload() {
    const source = document.querySelector(".enhance-page__inner .enhance-input-source");
    const input = source?.querySelector("input[type=file]");
    if (!source || !input) return;
    const dropzone = input.parentElement;
    const isVideo = (input.accept || "").includes("video");

    if (isVideo) {
      renderEnhanceMultiUpload(source, input, dropzone);
      return;
    }

    input.multiple = true;
    input.setAttribute("multiple", "");
    if (input.dataset.galaMultiUploadBound !== "true") {
      input.dataset.galaMultiUploadBound = "true";
      input.addEventListener("change", () => {
        if (!input.files?.length) return;
        appendEnhanceMultiUploadFiles(input.files);
        renderEnhanceMultiUpload(source, input, input.parentElement);
      });
      dropzone?.addEventListener("drop", (event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return;
        appendEnhanceMultiUploadFiles(files);
        renderEnhanceMultiUpload(source, input, input.parentElement);
      });
    }
    renderEnhanceMultiUpload(source, input, dropzone);
  }

  function ratioOptionInfo(option) {
    const text = cleanText(option.textContent);
    const match = text.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
    if (match) {
      const width = Number(match[1]);
      const height = Number(match[2]);
      if (width > 0 && height > 0) return { label: match[0], width, height };
    }
    if (/智能适配/.test(text)) return { label: "智能适配", width: 4, height: 3, smart: true };
    return null;
  }

  function createRatioOptionPreview(info) {
    const preview = document.createElement("span");
    preview.className = "gala-ratio-option-preview";
    preview.dataset.galaRatioPreview = info.label;
    preview.setAttribute("aria-hidden", "true");

    const shape = document.createElement("span");
    shape.className = "gala-ratio-option-preview-shape";
    const maxWidth = 18;
    const maxHeight = 13;
    const scale = Math.min(maxWidth / info.width, maxHeight / info.height);
    shape.style.width = `${Math.max(8, Math.round(info.width * scale))}px`;
    shape.style.height = `${Math.max(8, Math.round(info.height * scale))}px`;
    preview.appendChild(shape);
    if (info.smart) preview.dataset.smart = "true";
    return preview;
  }

  function setupAspectRatioOptionPreviews() {
    if (getRouteName() !== "online") return;

    document.querySelectorAll('[data-slot="select-item"]').forEach((option) => {
      const info = ratioOptionInfo(option);
      if (!info || option.querySelector("[data-gala-ratio-preview]")) return;

      // The shared select item uses a one-column check slot and a second
      // label slot. Put the preview inside the label slot so the selected
      // checkmark keeps its original alignment.
      const label = Array.from(option.children).find((child) =>
        child.matches("[class*='col-start-2']"),
      );
      const preview = createRatioOptionPreview(info);
      if (label) {
        label.classList.add("gala-ratio-option-label");
        label.prepend(preview);
      } else {
        option.prepend(preview);
      }
    });
  }

  function setupPromptEditFormLayout() {
    document.querySelectorAll(".template-detail-drawer .inline-edit-form").forEach((form) => {
      if (!form.querySelector(".prompt-generation-settings")) return;
      form.classList.add("gala-prompt-edit-form");
      form.closest(".template-detail-drawer")?.classList.add("gala-prompt-edit-drawer");
    });
  }

  function reactFiberForNode(node) {
    if (!node) return null;
    const key = Object.keys(node).find((name) => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"));
    return key ? node[key] : null;
  }

  function promptLibraryCardTags(card) {
    let fiber = reactFiberForNode(card);
    let depth = 0;
    while (fiber && depth < 80) {
      const props = fiber.memoizedProps || fiber.pendingProps;
      if (props?.item && (Array.isArray(props.tags) || Array.isArray(props.item.tags))) {
        return Array.isArray(props.tags) ? props.tags : props.item.tags;
      }
      fiber = fiber.return;
      depth += 1;
    }
    return null;
  }

  function setupPromptLibraryCards() {
    document.querySelectorAll(".prompt-workbench .prompt-row-library").forEach((card) => {
      const tags = promptLibraryCardTags(card);
      const tagLine = card.querySelector(":scope .tag-line");
      if (tagLine && tags) {
        const values = tags
          .map((tag) => (typeof tag === "string" ? tag : tag?.name))
          .map(cleanText)
          .filter(Boolean);
        const signature = values.join("\u0001");
        if (tagLine.dataset.galaTagsSignature !== signature) {
          tagLine.replaceChildren(...values.map((value) => {
            const tag = document.createElement("span");
            tag.className = "mini";
            tag.textContent = value;
            return tag;
          }));
          tagLine.dataset.galaTagsSignature = signature;
        }
      }

      const media = card.querySelector(":scope .prompt-row-media");
      const mediaGroups = Array.from(card.querySelectorAll(":scope .prompt-row-media-group"));
      const outputOnly = mediaGroups.length === 1 || media?.classList.contains("output-only");
      if (outputOnly) media?.classList.add("output-only");
      const inputLabel = outputOnly ? null : mediaGroups[0]?.querySelector(":scope > span");
      const outputLabel = (outputOnly ? mediaGroups[0] : mediaGroups[1])?.querySelector(":scope > span");
      if (inputLabel && cleanText(inputLabel.textContent) !== "输入示例") inputLabel.textContent = "输入示例";
      if (outputLabel && cleanText(outputLabel.textContent) !== "输出示例") outputLabel.textContent = "输出示例";
    });
  }

  function setupPromptPreviewMetadata() {
    document.querySelectorAll(".prompt-template-preview-dialog, .template-detail-drawer").forEach((dialog) => {
      const previewTitle = Array.from(dialog.querySelectorAll("strong"))
        .find((element) => cleanText(element.textContent) === "提示词预览");
      if (previewTitle) previewTitle.dataset.galaPromptPreviewTitle = "true";

      const titleRow = dialog.querySelector(".prompt-template-preview-title-row, .dtitle");
      const meta = dialog.querySelector(".prompt-template-preview-meta, .metas");
      if (!titleRow || !meta) return;
      dialog.classList.add("gala-prompt-preview-dialog");

      // In the canvas template preview, hide only the metadata copy; the
      // title-row ID remains visible beside the title.
      if (dialog.matches(".prompt-template-preview-dialog[data-canvas-overlay]")) {
        dialog.classList.add("gala-canvas-prompt-preview-dialog");
        meta.querySelectorAll(".meta-strip > *").forEach((item) => {
          if (/^ID\s+/i.test(cleanText(item.textContent))) {
            item.classList.add("gala-canvas-preview-id-hidden");
            item.style.setProperty("display", "none", "important");
          }
        });
        meta.querySelectorAll(".id-badge, .prompt-template-id").forEach((item) => {
          item.classList.add("gala-canvas-preview-id-hidden");
          item.style.setProperty("display", "none", "important");
        });
      }

      const id = meta.querySelector(".meta-strip .id-badge, .meta-strip .prompt-template-id, .id-badge, .prompt-template-id");
      if (id) {
        const idText = cleanText(id.textContent);
        let inlineId = titleRow.querySelector(":scope > .gala-inline-id");
        if (!inlineId) {
          inlineId = document.createElement("span");
          inlineId.className = "gala-inline-id";
        }
        inlineId.textContent = idText;
        inlineId.dataset.galaIdText = idText;
        inlineId.dataset.galaPreviewId = "true";
        if (!titleRow.contains(inlineId)) titleRow.appendChild(inlineId);
        if (!titleRow.contains(id)) id.classList.add("gala-preview-id-hidden");

        // The detail preview renders the favorite control as a sibling of the
        // title block. Keep the three controls in a deterministic order so
        // the favorite never falls back to the far edge of the row.
        if (titleRow.classList.contains("dtitle") || titleRow.classList.contains("prompt-template-preview-title-row")) {
          const favorite = titleRow.querySelector(":scope > .favorite-btn") || titleRow.querySelector(".favorite-btn");
          if (favorite) {
            favorite.dataset.galaPreviewFavorite = "true";
            titleRow.style.setProperty("align-items", "center", "important");
            titleRow.style.setProperty("gap", "8px", "important");
            titleRow.style.setProperty("justify-content", "flex-start", "important");
            favorite.style.setProperty("align-self", "center", "important");
            favorite.style.setProperty("flex", "0 0 30px", "important");
            favorite.style.setProperty("margin", "0", "important");
            favorite.style.setProperty("position", "static", "important");
            const titleBlock = Array.from(titleRow.children).find(
              (child) => child !== inlineId && child !== favorite,
            );
            const desiredOrder = [titleBlock, inlineId, favorite].filter(Boolean);
            const currentOrder = Array.from(titleRow.children);
            const needsReorder =
              desiredOrder.length !== currentOrder.length ||
              desiredOrder.some((child, index) => child !== currentOrder[index]);
            if (needsReorder) desiredOrder.forEach((child) => titleRow.appendChild(child));
            titleRow.dataset.galaPreviewTitleRow = "true";
          }
        }
      }

      Array.from(meta.querySelectorAll(".badge, .prompt-template-id")).forEach((item) => {
        if (cleanText(item.textContent).startsWith("最后编辑")) item.classList.add("gala-plain-updated");
      });
    });
  }

  function promptGenerationProps(node) {
    let fiber = reactFiberForNode(node);
    let depth = 0;
    while (fiber && depth < 80) {
      const props = fiber.memoizedProps || fiber.pendingProps;
      if (
        props &&
        typeof props.onChange === "function" &&
        props.value &&
        typeof props.value === "object" &&
        typeof props.templateType === "string" &&
        (Object.prototype.hasOwnProperty.call(props.value, "model") || Object.prototype.hasOwnProperty.call(props.value, "provider_id"))
      ) {
        return props;
      }
      fiber = fiber.return;
      depth += 1;
    }
    return null;
  }

  function promptModelOptionIsSelected(option, field) {
    if (
      option.getAttribute("data-state") === "checked" ||
      option.getAttribute("aria-selected") === "true" ||
      option.dataset.selected === "true"
    ) {
      return true;
    }

    const optionValue = option.getAttribute("data-value") || option.dataset.value || "";
    const trigger = field?.querySelector("[data-slot=select-trigger], button");
    const triggerValue = trigger?.getAttribute("data-value") || trigger?.dataset.value || "";
    if (optionValue && triggerValue) return optionValue === triggerValue;
    return Boolean(cleanText(trigger?.textContent) && cleanText(trigger.textContent) === cleanText(option.textContent));
  }

  function clearPromptModelSelection(props) {
    if (!props?.onChange || !props.value || typeof props.value !== "object") return;
    props.onChange({
      ...props.value,
      provider_id: "",
      model: "",
      mode: "",
      model_params: {},
    });
  }

  function togglePromptModelSelection(event) {
    const target = event.target instanceof Element ? event.target : null;
    const option = target?.closest("[role=option]");
    if (!option || !activePromptModelField || !promptModelOptionIsSelected(option, activePromptModelField)) return;

    const props = promptGenerationProps(activePromptModelField) || promptGenerationProps(option);
    if (!props?.value?.model) return;

    window.requestAnimationFrame(() => {
      const latest = promptGenerationProps(activePromptModelField) || props;
      if (latest.value?.model === props.value.model && latest.value?.provider_id === props.value.provider_id) {
        clearPromptModelSelection(latest);
      }
    });
  }

  function canvasLayerDecompositionElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  // Reuse the same Lucide paths as the bundled canvas toolbar for the
  // stand-alone decomposition Output node.
  function canvasOutputToolbarIcon(name) {
    const paths = {
      eye: [
        ["path", { d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" }],
        ["circle", { cx: "12", cy: "12", r: "3" }],
      ],
      wand: [
        ["path", { d: "m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" }],
        ["path", { d: "m14 7 3 3" }],
        ["path", { d: "M5 6v4" }],
        ["path", { d: "M19 14v4" }],
        ["path", { d: "M10 2v2" }],
        ["path", { d: "M7 8H3" }],
        ["path", { d: "M21 16h-4" }],
        ["path", { d: "M11 3H9" }],
      ],
      copy: [
        ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2" }],
        ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" }],
      ],
      download: [
        ["path", { d: "M12 15V3" }],
        ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
        ["path", { d: "m7 10 5 5 5-5" }],
      ],
    };
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    icon.classList.add("size-4");
    (paths[name] || []).forEach(([tag, attributes]) => {
      const child = document.createElementNS("http://www.w3.org/2000/svg", tag);
      Object.entries(attributes).forEach(([attribute, value]) => child.setAttribute(attribute, value));
      icon.appendChild(child);
    });
    return icon;
  }

  function canvasLayerDecompositionNodeKey(node) {
    const nativeId = canvasUploadNodeId(node);
    if (nativeId) return `canvas-layer-${nativeId}`;
    let key = canvasLayerDecompositionNodeKeys.get(node);
    if (!key) {
      canvasLayerDecompositionSequence += 1;
      key = `canvas-layer-image-${canvasLayerDecompositionSequence}`;
      canvasLayerDecompositionNodeKeys.set(node, key);
    }
    return key;
  }

  function canvasLayerDecompositionSource(node) {
    const media = node?.querySelector(":scope > .node-body img")
      || node?.querySelector(".node-body img")
      || node?.querySelector("img");
    const sourceUrl = media?.currentSrc || media?.src || "";
    if (!sourceUrl || sourceUrl === "about:blank") return null;
    const nodeId = canvasUploadNodeId(node);
    const uploadState = nodeId ? canvasPrototypeUploadStates.get(nodeId) : null;
    const storedNames = nodeId ? canvasFileNodeStates.get(nodeId) : null;
    const localName = [
      uploadState?.file?.name,
      storedNames?.[0],
      node?.dataset?.galaCanvasFileName,
      media?.alt,
      media?.dataset?.galaCanvasFileName,
    ]
      .map((value) => cleanText(value))
      .find((value) => (
        value
        && value !== "true"
        && value !== "image"
        && value !== "图片"
        && value !== "图片素材"
        && !/^上传图片\/视频\/音频\/文件$/.test(value)
      ));
    const title = localName || "图片素材";
    return {
      url: sourceUrl,
      name: title.split(",")[0].trim() || "图片素材",
      width: Number(media?.naturalWidth) || 2048,
      height: Number(media?.naturalHeight) || 2048,
    };
  }

  function canvasLayerDecompositionDefaultLayers() {
    return [
      {
        id: "base",
        name: "底图",
        description: "保留整体环境、色彩和空间关系。",
        bbox: { x: 0, y: 0, width: 1, height: 1 },
        zIndex: 0,
      },
      {
        id: "subject",
        name: "主体对象",
        description: "识别出的主要人物或产品主体，支持单独编辑。",
        bbox: { x: 0.16, y: 0.16, width: 0.58, height: 0.7 },
        zIndex: 3,
      },
      {
        id: "text",
        name: "标题文字",
        description: "从画面中分离出的标题、标识和排版元素。",
        bbox: { x: 0.1, y: 0.06, width: 0.46, height: 0.18 },
        zIndex: 5,
      },
      {
        id: "foreground",
        name: "前景装饰",
        description: "前景中的线条、贴纸和装饰元素。",
        bbox: { x: 0.02, y: 0.68, width: 0.92, height: 0.28 },
        zIndex: 6,
      },
      {
        id: "light",
        name: "阴影与光效",
        description: "尽量保持原图氛围的阴影、渐变和光效。",
        bbox: { x: 0, y: 0, width: 1, height: 1 },
        zIndex: 2,
      },
    ];
  }

  function canvasLayerDecompositionState(node) {
    const key = canvasLayerDecompositionNodeKey(node);
    let state = canvasLayerDecompositionStates.get(key);
    if (!state) {
      state = {
        key,
        phase: "idle",
        mode: "auto",
        prompt: "",
        size: "auto",
        taskId: "",
        source: null,
        node,
        layers: canvasLayerDecompositionDefaultLayers(),
        selectedLayerId: "subject",
        hiddenLayerIds: new Set(),
        extractedLayerIds: new Set(),
        extractedLayerNodes: new Map(),
        inputGroupNode: null,
        expanded: false,
        startedAt: 0,
        completedAt: 0,
        elapsedTicker: 0,
      };
      canvasLayerDecompositionStates.set(key, state);
    }
    state.node = node;
    state.source = canvasLayerDecompositionSource(node) || state.source;
    return state;
  }

  function canvasLayerDecompositionCandidate(node) {
    return Boolean(
      node
      && node.matches(".canvas-node.image-node")
      && !node.matches("[data-gala-layer-output-node]")
      && canvasLayerDecompositionSource(node),
    );
  }

  function canvasLayerDecompositionFormatSize(state) {
    const elapsed = state.phase === "running"
      ? Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000))
      : Math.max(0, Math.floor((state.completedAt - state.startedAt) / 1000));
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function canvasLayerDecompositionCopyIcon(toolbar) {
    const icon = canvasLayerDecompositionElement("img", "gala-layer-decompose-trigger-icon");
    icon.src = "/gala-layer-decompose-icon.svg";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    return icon;
  }

  function openCanvasLayerDecompositionPanel(node) {
    const state = canvasLayerDecompositionState(node);
    if (canvasLayerDecompositionPanel) {
      const sameNode = canvasLayerDecompositionPanel.key === state.key;
      closeCanvasLayerDecompositionPanel();
      if (sameNode) return;
    }

    const card = canvasLayerDecompositionElement(
      "section",
      "gala-layer-decomposition-card canvas-node-enhance-panel canvas-node-multi-angle-panel",
    );
    card.dataset.galaLayerDecompositionPanel = "true";
    card.dataset.canvasControl = "true";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "false");
    card.setAttribute("aria-labelledby", "gala-layer-decomposition-title");
    card.addEventListener("pointerdown", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const openWrap = card.querySelector('.gala-layer-decompose-select-wrap[data-open="true"]');
      if (!openWrap || openWrap.contains(target)) return;
      openWrap.dataset.open = "false";
      const menu = openWrap.querySelector(".gala-layer-decompose-select-menu");
      const trigger = openWrap.querySelector(".gala-layer-decompose-select-trigger");
      if (menu) menu.hidden = true;
      trigger?.setAttribute("aria-expanded", "false");
    });
    node.appendChild(card);
    const outsideHandler = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const activeNode = canvasLayerDecompositionPanel?.node || node;
      if (target && (card.contains(target) || activeNode.contains(target))) return;
      closeCanvasLayerDecompositionPanel();
    };
    document.addEventListener("pointerdown", outsideHandler, true);
    canvasLayerDecompositionPanel = { root: card, card, key: state.key, node, outsideHandler };
    renderCanvasLayerDecompositionPanel(canvasLayerDecompositionPanel);
    positionCanvasLayerDecompositionPanel(canvasLayerDecompositionPanel);
  }

  function closeCanvasLayerDecompositionPanel() {
    if (canvasLayerDecompositionPanel?.outsideHandler) {
      document.removeEventListener("pointerdown", canvasLayerDecompositionPanel.outsideHandler, true);
    }
    canvasLayerDecompositionPanel?.root?.remove();
    canvasLayerDecompositionPanel = null;
  }

  function positionCanvasLayerDecompositionPanel(panel) {
    if (!panel?.card) return;
    const node = panel.node?.isConnected
      ? panel.node
      : Array.from(document.querySelectorAll(".canvas-node.image-node"))
        .find((candidate) => canvasLayerDecompositionNodeKey(candidate) === panel.key);
    if (!node) return;
    panel.node = node;
    if (panel.card.parentElement !== node) node.appendChild(panel.card);
    panel.card.style.removeProperty("left");
    panel.card.style.removeProperty("top");
    panel.card.style.removeProperty("width");
  }

  function renderCanvasLayerDecompositionPanel(panel) {
    if (!panel?.card) return;
    const state = canvasLayerDecompositionStates.get(panel.key);
    if (!state) return;
    const card = panel.card;
    card.dataset.phase = state.phase;
    card.replaceChildren();

    const header = canvasLayerDecompositionElement("header", "gala-layer-decompose-header");
    const heading = canvasLayerDecompositionElement("div", "gala-layer-decompose-heading");
    heading.appendChild(canvasLayerDecompositionElement("span", "gala-layer-decompose-eyebrow", "AI 工具"));
    const panelTitle = canvasLayerDecompositionElement("h2", "", "AI拆层");
    panelTitle.id = "gala-layer-decomposition-title";
    heading.appendChild(panelTitle);
    heading.appendChild(canvasLayerDecompositionElement("p", "", "保留原图，生成可单独编辑的透明图层"));
    const close = canvasLayerDecompositionElement("button", "gala-layer-decompose-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭 AI 拆层");
    close.addEventListener("click", closeCanvasLayerDecompositionPanel);
    header.append(heading, close);
    card.appendChild(header);

    if (state.phase === "running") {
      const progress = canvasLayerDecompositionElement("div", "gala-layer-decompose-progress");
      progress.appendChild(canvasLayerDecompositionElement("span", "gala-layer-decompose-status-dot"));
      const progressCopy = canvasLayerDecompositionElement("div", "gala-layer-decompose-progress-copy");
      progressCopy.appendChild(canvasLayerDecompositionElement("strong", "", "正在智能拆层"));
      progressCopy.appendChild(canvasLayerDecompositionElement("span", "", "正在识别主体、文字与前景元素"));
      progress.appendChild(progressCopy);
      card.appendChild(progress);

      const bar = canvasLayerDecompositionElement("div", "gala-layer-decompose-progress-bar");
      bar.appendChild(canvasLayerDecompositionElement("span"));
      card.appendChild(bar);

      const elapsed = canvasLayerDecompositionElement("div", "gala-layer-decompose-elapsed");
      elapsed.appendChild(canvasLayerDecompositionElement("span", "", "已用时"));
      const elapsedValue = canvasLayerDecompositionElement("strong", "", canvasLayerDecompositionFormatSize(state));
      elapsedValue.dataset.galaLayerElapsed = "true";
      elapsed.appendChild(elapsedValue);
      card.appendChild(elapsed);
      card.appendChild(canvasLayerDecompositionElement(
        "p",
        "gala-layer-decompose-note",
        "关闭面板不会取消任务，完成后会在原图旁生成新的 Output。",
      ));
      return;
    }

    if (state.phase === "succeeded") {
      const result = canvasLayerDecompositionElement("div", "gala-layer-decompose-result");
      const preview = canvasLayerDecompositionElement("div", "gala-layer-decompose-result-preview");
      const image = canvasLayerDecompositionElement("img");
      image.src = state.source?.url || "";
      image.alt = "拆层重组预览";
      preview.appendChild(image);
      const count = canvasLayerDecompositionElement("span", "gala-layer-decompose-result-count", `${state.layers.length} 个图层`);
      preview.appendChild(count);
      const resultCopy = canvasLayerDecompositionElement("div", "gala-layer-decompose-result-copy");
      resultCopy.appendChild(canvasLayerDecompositionElement("strong", "", "AI拆层已完成"));
      resultCopy.appendChild(canvasLayerDecompositionElement("span", "", "已生成重组预览、透明 PNG 图层和 PSD"));
      result.append(preview, resultCopy);
      card.appendChild(result);

      const actions = canvasLayerDecompositionElement("div", "gala-layer-decompose-actions");
      const view = canvasLayerDecompositionElement("button", "gala-layer-decompose-primary", "查看图层");
      view.type = "button";
      view.addEventListener("click", () => openCanvasLayerViewer(state.node, state));
      const restart = canvasLayerDecompositionElement("button", "gala-layer-decompose-secondary", "重新拆分");
      restart.type = "button";
      restart.addEventListener("click", () => {
        state.phase = "idle";
        state.expanded = false;
        renderCanvasLayerDecompositionPanel(panel);
      });
      actions.append(view, restart);
      card.appendChild(actions);
      card.appendChild(canvasLayerDecompositionElement(
        "p",
        "gala-layer-decompose-note",
        "原图保持不变；Output 节点可继续连接到后续工作流。",
      ));
      return;
    }

    const modeField = canvasLayerDecompositionElement("div", "gala-layer-decompose-field");
    modeField.appendChild(canvasLayerDecompositionElement("label", "", "拆分方式"));
    const modeTabs = canvasLayerDecompositionElement("div", "gala-layer-decompose-mode-tabs");
    [
      { value: "auto", label: "自动识别" },
      { value: "description", label: "按描述拆分" },
    ].forEach((option) => {
      const button = canvasLayerDecompositionElement("button", state.mode === option.value ? "active" : "", option.label);
      button.type = "button";
      button.setAttribute("aria-pressed", state.mode === option.value ? "true" : "false");
      button.addEventListener("click", () => {
        state.mode = option.value;
        renderCanvasLayerDecompositionPanel(panel);
      });
      modeTabs.appendChild(button);
    });
    modeField.appendChild(modeTabs);
    card.appendChild(modeField);

    if (state.mode === "description") {
      const promptField = canvasLayerDecompositionElement("div", "gala-layer-decompose-field");
      const promptLabel = canvasLayerDecompositionElement("label", "", "拆分描述");
      promptField.appendChild(promptLabel);
      const prompt = canvasLayerDecompositionElement("textarea", "gala-layer-decompose-textarea");
      prompt.placeholder = "例如：拆出人物主体、标题文字、产品和前景装饰";
      prompt.value = state.prompt;
      prompt.addEventListener("input", () => {
        state.prompt = prompt.value;
      });
      promptField.appendChild(prompt);
      card.appendChild(promptField);
    }

    const sizeField = canvasLayerDecompositionElement("div", "gala-layer-decompose-field");
    sizeField.appendChild(canvasLayerDecompositionElement("label", "", "输出尺寸"));
    const sizeOptions = [
      ["auto", "自动"],
      ["1K", "1K"],
      ["1.5K", "1.5K"],
      ["2K", "2K"],
    ];
    const selectedSize = sizeOptions.find(([value]) => value === state.size) || sizeOptions[0];
    const sizeWrap = canvasLayerDecompositionElement("div", "gala-layer-decompose-select-wrap");
    const sizeTrigger = canvasLayerDecompositionElement("button", "gala-layer-decompose-select-trigger");
    sizeTrigger.type = "button";
    sizeTrigger.setAttribute("aria-haspopup", "listbox");
    sizeTrigger.setAttribute("aria-expanded", "false");
    const sizeValue = canvasLayerDecompositionElement("span", "gala-layer-decompose-select-value", selectedSize[1]);
    const sizeChevron = canvasLayerDecompositionElement("span", "gala-layer-decompose-select-chevron");
    sizeChevron.setAttribute("aria-hidden", "true");
    sizeTrigger.append(sizeValue, sizeChevron);
    const sizeMenu = canvasLayerDecompositionElement("div", "gala-layer-decompose-select-menu");
    sizeMenu.setAttribute("role", "listbox");
    sizeMenu.setAttribute("aria-label", "输出尺寸");
    sizeOptions.forEach(([value, label]) => {
      const option = canvasLayerDecompositionElement("button", "gala-layer-decompose-select-option", label);
      option.type = "button";
      option.dataset.value = value;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", value === selectedSize[0] ? "true" : "false");
      option.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.size = value;
        renderCanvasLayerDecompositionPanel(panel);
      });
      sizeMenu.appendChild(option);
    });
    sizeTrigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = sizeWrap.dataset.open === "true";
      const open = !isOpen;
      sizeWrap.dataset.open = open ? "true" : "false";
      sizeMenu.hidden = !open;
      sizeTrigger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    sizeMenu.hidden = true;
    sizeWrap.append(sizeTrigger, sizeMenu);
    sizeField.appendChild(sizeWrap);
    card.appendChild(sizeField);

    card.appendChild(canvasLayerDecompositionElement(
      "p",
      "gala-layer-decompose-note",
      "原图不会被修改，完成后会在画布中生成一个新的 Output。",
    ));

    const footer = canvasLayerDecompositionElement("footer", "gala-layer-decompose-footer");
    const cancel = canvasLayerDecompositionElement("button", "gala-layer-decompose-secondary", "取消");
    cancel.type = "button";
    cancel.addEventListener("click", closeCanvasLayerDecompositionPanel);
    const submit = canvasLayerDecompositionElement("button", "gala-layer-decompose-primary", "开始AI拆层");
    submit.type = "button";
    submit.addEventListener("click", () => startCanvasLayerDecomposition(state, panel));
    footer.append(cancel, submit);
    card.appendChild(footer);
  }

  function startCanvasLayerDecomposition(state, panel) {
    if (!state?.source || state.phase === "running") return;
    const previousOutput = canvasLayerDecompositionOutputs.get(state.key);
    previousOutput?.connectionSvg?.remove();
    previousOutput?.root?.remove();
    canvasLayerDecompositionOutputs.delete(state.key);
    state.phase = "running";
    state.taskId = `layer-demo-${Date.now()}`;
    const taskId = state.taskId;
    state.startedAt = Date.now();
    state.completedAt = 0;
    state.expanded = false;
    renderCanvasLayerDecompositionPanel(panel);

    if (state.elapsedTicker) window.clearInterval(state.elapsedTicker);
    state.elapsedTicker = window.setInterval(() => {
      if (state.phase !== "running" || state.taskId !== taskId) {
        window.clearInterval(state.elapsedTicker);
        state.elapsedTicker = 0;
        return;
      }
      const activePanel = canvasLayerDecompositionPanel?.key === state.key
        ? canvasLayerDecompositionPanel.card
        : null;
      const elapsed = activePanel?.querySelector("[data-gala-layer-elapsed]");
      if (elapsed) elapsed.textContent = canvasLayerDecompositionFormatSize(state);
    }, 1000);

    // This is deliberately a local demo state. The API contract from the
    // product note can replace this timer without changing the interaction.
    window.setTimeout(() => {
      if (state.taskId !== taskId || state.phase !== "running") return;
      state.phase = "succeeded";
      state.completedAt = Date.now();
      if (state.elapsedTicker) window.clearInterval(state.elapsedTicker);
      state.elapsedTicker = 0;
      ensureCanvasLayerDecompositionOutput(state.node, state);
      if (canvasLayerDecompositionPanel?.key === state.key) {
        renderCanvasLayerDecompositionPanel(canvasLayerDecompositionPanel);
      }
    }, 2400);
  }

  function positionCanvasLayerDecompositionOutput(output) {
    if (!output?.root?.isConnected) return;
    const node = output.node;
    const layer = node?.parentElement || output.layer || document.querySelector(".canvas-world");
    if (layer && output.root.parentElement !== layer) layer.appendChild(output.root);
    output.layer = layer;

    // Native canvas nodes use a local translate inside .canvas-world. Put the
    // result in that same coordinate system so zooming/panning keeps the
    // Output beside its source instead of pinning it to the viewport.
    const { x, y } = canvasLayerDecompositionNodeCoordinates(node);
    const nodeWidth = Number(node?.offsetWidth) || 260;
    const nodeHeight = Number(node?.offsetHeight) || 240;
    const outputHeight = Number(output.root.offsetHeight) || 240;
    const gap = 64;
    const outputX = x + nodeWidth + gap;
    const outputY = y + Math.round((nodeHeight - outputHeight) / 2);
    const position = output.position || { x: outputX, y: outputY };
    output.root.style.removeProperty("left");
    output.root.style.removeProperty("top");
    output.root.style.width = "460px";
    output.root.style.transform = `translate(${Math.round(position.x)}px, ${Math.round(position.y)}px)`;
  }

  function canvasLayerDecompositionCanvasScale() {
    const world = document.querySelector(".canvas-world");
    if (!world) return 1;
    const transform = window.getComputedStyle(world).transform || "";
    const match = transform.match(/^matrix\(([-\d.e]+),\s*[-\d.e]+,\s*[-\d.e]+,\s*([-\d.e]+),/);
    const scale = Number(match?.[1]) || Number(match?.[2]) || 1;
    return Math.max(.1, Math.abs(scale));
  }

  function selectCanvasLayerDecompositionOutput(output) {
    document.querySelectorAll(".gala-layer-output-node.selected").forEach((node) => {
      if (node !== output?.root) node.classList.remove("selected");
    });
    output?.root?.classList.add("selected");
  }

  function bindCanvasLayerDecompositionOutputInteractions(output) {
    const root = output?.root;
    if (!root || root.dataset.galaLayerOutputInteractionsBound === "true") return;
    root.dataset.galaLayerOutputInteractionsBound = "true";
    root.tabIndex = 0;
    root.setAttribute("aria-label", "AI 拆层 Output 节点");

    let drag = null;
    const finishDrag = (event) => {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      root.classList.remove("is-dragging");
      try {
        root.releasePointerCapture?.(drag.pointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
      drag = null;
    };

    root.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("button, input, textarea, select, [data-canvas-control]")) return;

      const coordinates = canvasLayerDecompositionNodeCoordinates(root);
      selectCanvasLayerDecompositionOutput(output);
      event.preventDefault();
      event.stopPropagation();
      drag = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        x: coordinates.x,
        y: coordinates.y,
      };
      root.classList.add("is-dragging");
      root.setPointerCapture?.(event.pointerId);
    });

    root.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const scale = canvasLayerDecompositionCanvasScale();
      output.position = {
        x: drag.x + (event.clientX - drag.clientX) / scale,
        y: drag.y + (event.clientY - drag.clientY) / scale,
      };
      root.style.transform = `translate(${Math.round(output.position.x)}px, ${Math.round(output.position.y)}px)`;
      renderCanvasLayerDecompositionConnection(output);
      event.preventDefault();
    });

    root.addEventListener("pointerup", finishDrag);
    root.addEventListener("pointercancel", finishDrag);
    root.addEventListener("lostpointercapture", () => finishDrag());
  }

  function canvasLayerDecompositionNodeCoordinates(node) {
    const transform = node?.style?.transform || "";
    const match = transform.match(/translate(?:3d)?\(\s*(-?[\d.]+)px[\s,]+(-?[\d.]+)px/);
    return {
      x: Number(match?.[1]) || Number(node?.offsetLeft) || 0,
      y: Number(match?.[2]) || Number(node?.offsetTop) || 0,
    };
  }

  function clearCanvasLayerDecompositionNodeSelection(node) {
    if (!node) return;
    node.classList.remove("selected", "is-selected", "active");
    node.removeAttribute("aria-selected");
    delete node.dataset.selected;
    delete node.dataset.active;
    node.querySelectorAll(".selected, .is-selected").forEach((element) => {
      element.classList.remove("selected", "is-selected");
    });
    node.querySelectorAll("[aria-selected]").forEach((element) => {
      element.removeAttribute("aria-selected");
    });
    node.querySelectorAll('[data-selected="true"], [data-active="true"]').forEach((element) => {
      delete element.dataset.selected;
      delete element.dataset.active;
    });
  }

  function selectCanvasLayerDecompositionNode(node) {
    if (!node) return;
    document.querySelectorAll(".gala-canvas-layer-node.selected").forEach((candidate) => {
      if (candidate !== node) candidate.classList.remove("selected");
    });
    node.classList.add("selected");
  }

  function bindCanvasLayerDecompositionNodeInteractions(node) {
    if (!node || node.dataset.galaLayerNodeInteractionsBound === "true") return;
    node.dataset.galaLayerNodeInteractionsBound = "true";
    node.tabIndex = 0;
    node.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".media-node-toolbar, button, input, textarea, select, [data-canvas-control]")) {
        selectCanvasLayerDecompositionNode(node);
        return;
      }
      selectCanvasLayerDecompositionNode(node);
      event.stopPropagation();
    });
    node.addEventListener("focus", () => selectCanvasLayerDecompositionNode(node));
  }

  function bindCanvasLayerInputGroupInteractions(group) {
    if (!group || group.dataset.galaLayerInputGroupInteractionsBound === "true") return;
    group.dataset.galaLayerInputGroupInteractionsBound = "true";

    let drag = null;
    const getMemberNodes = () => Array.from(group.__galaLayerInputGroupNodes || [])
      .filter((node) => node?.isConnected);
    const isControlTarget = (target) => target instanceof Element
      && Boolean(target.closest("button, input, textarea, select, [data-canvas-control]"));
    const finishDrag = (event) => {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      group.classList.remove("is-dragging");
      try {
        group.releasePointerCapture?.(drag.pointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
      drag = null;
    };

    group.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || isControlTarget(event.target)) return;
      const nodes = getMemberNodes();
      if (!nodes.length) return;
      const groupPosition = canvasLayerDecompositionNodeCoordinates(group);
      drag = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        groupX: groupPosition.x,
        groupY: groupPosition.y,
        nodes: nodes.map((node) => ({
          node,
          position: canvasLayerDecompositionNodeCoordinates(node),
        })),
      };
      group.classList.add("is-dragging");
      group.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    });

    group.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const scale = canvasLayerDecompositionCanvasScale();
      const deltaX = (event.clientX - drag.clientX) / scale;
      const deltaY = (event.clientY - drag.clientY) / scale;
      group.style.transform = `translate(${Math.round(drag.groupX + deltaX)}px, ${Math.round(drag.groupY + deltaY)}px)`;
      drag.nodes.forEach(({ node, position }) => {
        node.style.transform = `translate(${Math.round(position.x + deltaX)}px, ${Math.round(position.y + deltaY)}px)`;
      });
      event.preventDefault();
    });

    group.addEventListener("pointerup", finishDrag);
    group.addEventListener("pointercancel", finishDrag);
    group.addEventListener("lostpointercapture", () => finishDrag());
  }

  function createCanvasLayerDecompositionNode(sourceNode, layer, state, index) {
    if (!sourceNode?.parentElement || !layer) return null;
    if (!state.extractedLayerNodes) state.extractedLayerNodes = new Map();
    const existing = state.extractedLayerNodes.get(layer.id);
    if (existing?.isConnected) return existing;

    const node = sourceNode.cloneNode(true);
    const nodeId = `gala-layer-extract-${Date.now()}-${++canvasLayerExtractSequence}`;
    const sourceCoordinates = canvasLayerDecompositionNodeCoordinates(sourceNode);
    const nodeWidth = Number(sourceNode.offsetWidth) || 260;
    const nodeHeight = Number(sourceNode.offsetHeight) || 240;
    const column = index % 3;
    const row = Math.floor(index / 3);

    node.dataset.canvasNodeId = nodeId;
    node.dataset.id = nodeId;
    node.dataset.galaLayerNode = "true";
    node.dataset.galaLayerSourceKey = state.key;
    node.dataset.galaLayerId = layer.id;
    node.title = "IMAGE";
    node.classList.add("gala-canvas-layer-node", "image-node", "has-image");
    node.classList.remove("selected", "gala-canvas-prototype-upload");
    clearCanvasLayerDecompositionNodeSelection(node);
    delete node.dataset.galaCanvasPrototypeUpload;
    delete node.dataset.galaCanvasPrototypeControlsBound;
    delete node.dataset.galaCanvasPrototypeRendered;
    delete node.dataset.galaCanvasPrototypeUploadSlot;
    delete node.dataset.galaCanvasFileNode;
    delete node.dataset.galaCanvasFileName;
    delete node.dataset.galaCanvasReviewPhase;
    delete node.dataset.galaCanvasMediaKind;
    node.querySelectorAll("[data-gala-layer-decomposition-trigger]").forEach((trigger) => trigger.remove());
    node.querySelectorAll(".gala-layer-decomposition-card").forEach((panel) => panel.remove());

    const title = node.querySelector(":scope > .node-head .node-title") || node.querySelector(".node-title");
    if (title) title.textContent = "IMAGE";
    node.setAttribute("aria-label", "IMAGE 图片节点");
    bindCanvasLayerDecompositionNodeInteractions(node);

    const x = sourceCoordinates.x + column * (nodeWidth + 24);
    const y = sourceCoordinates.y + nodeHeight + 48 + row * (nodeHeight + 24);
    node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    node.style.zIndex = String(200 + canvasLayerExtractSequence);
    sourceNode.parentElement.appendChild(node);

    state.extractedLayerIds.add(layer.id);
    state.extractedLayerNodes.set(layer.id, node);
    scheduleApply();
    return node;
  }

  function extractCanvasLayerToNode(viewer, layer) {
    if (!viewer?.node || !viewer?.state || !layer) return null;
    const index = viewer.state.layers.findIndex((candidate) => candidate.id === layer.id);
    return createCanvasLayerDecompositionNode(viewer.node, layer, viewer.state, Math.max(0, index));
  }

  function expandAllCanvasLayersToNodes(viewer) {
    if (!viewer?.node || !viewer?.state) return [];
    const created = [];
    viewer.state.layers.forEach((layer, index) => {
      const existing = viewer.state.extractedLayerNodes?.get(layer.id);
      const wasAlreadyCreated = Boolean(existing?.isConnected);
      const node = createCanvasLayerDecompositionNode(viewer.node, layer, viewer.state, index);
      if (node && !wasAlreadyCreated) created.push(node);
    });
    return created;
  }

  function groupCanvasLayerDecompositionNodes(viewer) {
    if (!viewer?.node || !viewer?.state) return null;
    const parent = viewer.node.parentElement;
    const nodes = viewer.state.layers
      .map((layer) => viewer.state.extractedLayerNodes?.get(layer.id))
      .filter((node) => node?.isConnected && node.parentElement === parent);
    if (!parent || !nodes.length) return null;

    const coordinates = nodes.map((node) => {
      const position = canvasLayerDecompositionNodeCoordinates(node);
      return {
        x: position.x,
        y: position.y,
        width: Number(node.offsetWidth) || 260,
        height: Number(node.offsetHeight) || 240,
      };
    });
    const minX = Math.min(...coordinates.map((item) => item.x));
    const minY = Math.min(...coordinates.map((item) => item.y));
    const maxX = Math.max(...coordinates.map((item) => item.x + item.width));
    const maxY = Math.max(...coordinates.map((item) => item.y + item.height));
    const group = viewer.state.inputGroupNode?.isConnected
      ? viewer.state.inputGroupNode
      : document.createElement("div");

    group.className = "canvas-group-preview gala-layer-input-group";
    group.dataset.galaLayerInputGroup = "true";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", `输入组，包含 ${nodes.length} 个图层`);
    group.replaceChildren();
    const label = document.createElement("span");
    label.className = "gala-layer-input-group-label";
    label.textContent = `输入组 · ${nodes.length} 个图层`;
    group.appendChild(label);
    group.style.transform = `translate(${Math.round(minX - 24)}px, ${Math.round(minY - 42)}px)`;
    group.style.width = `${Math.round(maxX - minX + 48)}px`;
    group.style.height = `${Math.round(maxY - minY + 66)}px`;
    group.style.zIndex = "150";
    if (!group.isConnected) parent.insertBefore(group, parent.firstChild);
    viewer.state.inputGroupNode = group;
    group.__galaLayerInputGroupNodes = nodes;
    bindCanvasLayerInputGroupInteractions(group);
    nodes.forEach((node) => {
      node.dataset.galaLayerInputGroup = "true";
      node.dataset.galaLayerInputGroupId = viewer.state.key;
      node.classList.add("gala-canvas-input-group-member");
    });
    return group;
  }

  function ensureCanvasLayerDecompositionOutput(node, state) {
    let output = canvasLayerDecompositionOutputs.get(state.key);
    if (!output) {
      const root = canvasLayerDecompositionElement("article", "node canvas-node output-node gala-layer-output-node");
      root.dataset.galaLayerOutputNode = "true";
      root.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("[data-gala-layer-output-close]")) {
          output?.connectionSvg?.remove();
          root.remove();
          canvasLayerDecompositionOutputs.delete(state.key);
          return;
        }
        if (target?.closest("[data-gala-layer-output-preview]")) {
          openCanvasLayerOutputPreview(state);
          return;
        }
        if (target?.closest("[data-gala-layer-output-viewer]")) {
          openCanvasLayerViewer(node, state);
        }
      });
      const layer = node?.parentElement || document.querySelector(".canvas-world") || document.body;
      layer.appendChild(root);
      output = { root, node, layer, position: null };
      canvasLayerDecompositionOutputs.set(state.key, output);
    }
    output.node = node;
    bindCanvasLayerDecompositionOutputInteractions(output);
    renderCanvasLayerDecompositionOutput(output, state);
    positionCanvasLayerDecompositionOutput(output);
    renderCanvasLayerDecompositionConnection(output);
    return output;
  }

  function canvasLayerDecompositionNativeConnectionExists(output) {
    const sourcePort = canvasPortCenter(output?.node, ".port.out");
    const targetPort = canvasPortCenter(output?.root, ".port.in");
    if (!sourcePort || !targetPort) return false;

    return Array.from(document.querySelectorAll(
      "[data-canvas-connections-layer] path[data-connection-id]",
    ))
      .filter((path) => !path.classList.contains("link-hit"))
      .some((path) => {
        let length = 0;
        try {
          length = path.getTotalLength();
        } catch {
          return false;
        }
        const start = canvasPathScreenPoint(path, 0);
        const end = canvasPathScreenPoint(path, length);
        return Boolean(
          (canvasPointNear(start, sourcePort, 12) && canvasPointNear(end, targetPort, 12))
          || (canvasPointNear(start, targetPort, 12) && canvasPointNear(end, sourcePort, 12)),
        );
      });
  }

  function renderCanvasLayerDecompositionConnection(output) {
    if (!output?.root?.isConnected || !output?.node?.isConnected) return;
    const layer = output.layer || output.node.parentElement;
    if (!layer) return;

    if (!output.connectionSvg || !output.connectionSvg.isConnected) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      svg.classList.add("gala-layer-output-connection-layer");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("viewBox", "0 0 10000 10000");
      svg.setAttribute("preserveAspectRatio", "none");
      path.classList.add("gala-layer-output-connection-path");
      svg.appendChild(path);
      output.connectionSvg = svg;
      output.connectionPath = path;
    }

    const svg = output.connectionSvg;
    if (svg.parentElement !== layer) {
      layer.insertBefore(svg, layer.firstChild);
    }

    if (canvasLayerDecompositionNativeConnectionExists(output)) {
      svg.hidden = true;
      return;
    }

    const sourceCoordinates = canvasLayerDecompositionNodeCoordinates(output.node);
    const outputCoordinates = canvasLayerDecompositionNodeCoordinates(output.root);
    const sourceWidth = Number(output.node.offsetWidth) || 260;
    const sourceHeight = Number(output.node.offsetHeight) || 240;
    const outputHeight = Number(output.root.offsetHeight) || 240;
    const start = {
      x: sourceCoordinates.x + sourceWidth,
      y: sourceCoordinates.y + sourceHeight / 2,
    };
    const end = {
      x: outputCoordinates.x,
      y: outputCoordinates.y + outputHeight / 2,
    };
    const curve = Math.max(80, Math.abs(end.x - start.x) * .45);
    output.connectionPath.setAttribute(
      "d",
      `M ${start.x} ${start.y} C ${start.x + curve} ${start.y}, ${end.x - curve} ${end.y}, ${end.x} ${end.y}`,
    );
    svg.hidden = false;
  }

  function renderCanvasLayerDecompositionOutput(output, state) {
    const root = output.root;
    root.classList.toggle("is-pending", state.phase === "running");
    root.classList.toggle("is-success", state.phase === "succeeded");
    root.replaceChildren();

    const toolbar = canvasLayerDecompositionElement("div", "media-node-toolbar");
    toolbar.dataset.canvasControl = "true";
    [
      {
        label: "预览图片",
        icon: "eye",
        onSelect: () => openCanvasLayerOutputPreview(state),
      },
      {
        label: "转为输入组",
        icon: "wand",
        onSelect: () => openCanvasLayerViewer(state.node, state),
      },
      {
        label: "复制为新的输入组",
        icon: "copy",
        onSelect: () => {
          const created = expandAllCanvasLayersToNodes({ node: state.node, state });
          showAttachmentReviewToast(
            created.length ? `已复制 ${created.length} 个图层节点` : "图层节点已存在",
            "success",
          );
        },
      },
      {
        label: "下载全部图片",
        icon: "download",
        onSelect: () => {
          const link = document.createElement("a");
          link.href = state.source?.url || "";
          link.download = state.source?.name || "layer-output.png";
          link.target = "_blank";
          link.rel = "noopener";
          link.click();
        },
      },
    ].forEach((action) => {
      const button = canvasLayerDecompositionElement("button", "media-node-toolbar-btn");
      button.type = "button";
      button.title = action.label;
      button.setAttribute("aria-label", action.label);
      button.append(canvasOutputToolbarIcon(action.icon), canvasLayerDecompositionElement("span", "", action.label));
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        action.onSelect();
      });
      toolbar.appendChild(button);
    });
    root.appendChild(toolbar);

    const header = canvasLayerDecompositionElement("header", "node-head gala-layer-output-header");
    const heading = canvasLayerDecompositionElement("div", "gala-layer-output-heading");
    heading.appendChild(canvasLayerDecompositionElement("span", "node-title", "OUTPUT"));
    const close = canvasLayerDecompositionElement("button", "gala-layer-output-close", "×");
    close.type = "button";
    close.dataset.galaLayerOutputClose = "true";
    close.setAttribute("aria-label", "移除结果预览");
    header.append(heading, close);
    root.appendChild(header);

    const body = canvasLayerDecompositionElement("div", "node-body gala-layer-output-body");
    root.appendChild(body);

    if (state.phase === "running") {
      const placeholder = canvasLayerDecompositionElement("div", "gala-layer-output-placeholder");
      placeholder.appendChild(canvasLayerDecompositionElement("span", "gala-layer-output-spinner"));
      placeholder.appendChild(canvasLayerDecompositionElement("strong", "", "正在智能拆层"));
      placeholder.appendChild(canvasLayerDecompositionElement("span", "", "原图保持不变 · 任务继续中"));
      body.appendChild(placeholder);
      const footer = canvasLayerDecompositionElement("footer", "gala-layer-output-footer");
      footer.appendChild(canvasLayerDecompositionElement("span", "", "已用时"));
      const elapsed = canvasLayerDecompositionElement("strong", "", canvasLayerDecompositionFormatSize(state));
      elapsed.dataset.galaLayerElapsed = "true";
      footer.appendChild(elapsed);
      body.appendChild(footer);
      return;
    }

    const grid = canvasLayerDecompositionElement("div", "output-grid gala-layer-output-grid");
    const previewWrap = canvasLayerDecompositionElement("div", "output-img-wrap gala-layer-output-img-wrap");
    const image = canvasLayerDecompositionElement("img");
    image.src = state.source?.url || "";
    image.alt = "拆层重组预览";
    previewWrap.dataset.galaLayerOutputPreview = "true";
    previewWrap.dataset.canvasControl = "true";
    previewWrap.setAttribute("aria-label", "预览图片");
    previewWrap.setAttribute("role", "button");
    previewWrap.tabIndex = 0;
    previewWrap.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openCanvasLayerOutputPreview(state);
    });
    previewWrap.appendChild(image);
    grid.appendChild(previewWrap);
    body.appendChild(grid);

    const actions = canvasLayerDecompositionElement("footer", "gala-layer-output-actions");
    const view = canvasLayerDecompositionElement("button", "gala-layer-output-view", "查看图层");
    view.type = "button";
    view.dataset.galaLayerOutputViewer = "true";
    actions.appendChild(view);
    body.appendChild(actions);

    const inputPort = canvasLayerDecompositionElement("button", "port in");
    inputPort.type = "button";
    inputPort.dataset.canvasControl = "true";
    inputPort.dataset.galaLayerOutputInput = "true";
    inputPort.setAttribute("aria-label", "连接到 Output");
    inputPort.title = "连接到 Output";
    root.appendChild(inputPort);
  }

  function closeCanvasLayerOutputPreview() {
    if (canvasLayerOutputPreview?.keydownHandler) {
      document.removeEventListener("keydown", canvasLayerOutputPreview.keydownHandler, true);
    }
    canvasLayerOutputPreview?.root?.remove();
    canvasLayerOutputPreview = null;
  }

  function openCanvasLayerOutputPreview(state) {
    if (!state?.source?.url) return;
    closeCanvasLayerOutputPreview();

    const backdrop = canvasLayerDecompositionElement("div", "gala-layer-output-preview-backdrop");
    backdrop.dataset.galaLayerOutputPreviewDialog = "true";

    const shell = canvasLayerDecompositionElement(
      "section",
      "image-editor-dialog-shell is-preview-shell is-mode-preview gala-layer-output-preview-dialog",
    );
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-label", "图片预览");

    const header = canvasLayerDecompositionElement("header", "image-editor-dialog-shell__header");
    const close = canvasLayerDecompositionElement("button", "image-editor-dialog-shell__close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭图片预览");
    close.addEventListener("click", closeCanvasLayerOutputPreview);
    header.appendChild(close);
    shell.appendChild(header);

    const body = canvasLayerDecompositionElement("div", "image-editor-dialog-shell__body");
    const frame = canvasLayerDecompositionElement("div", "image-editor-dialog-shell__stage-frame");
    const stage = canvasLayerDecompositionElement(
      "main",
      "image-editor-dialog-shell__stage is-framed output-preview-dialog__stage gala-layer-output-preview-stage",
    );
    const canvas = canvasLayerDecompositionElement("div", "output-preview-dialog__canvas");
    const image = canvasLayerDecompositionElement("img", "output-preview-dialog__image gala-layer-output-preview-dialog-image");
    image.src = state.source.url;
    image.alt = state.source.name || "图片预览";
    image.draggable = false;
    canvas.appendChild(image);
    stage.appendChild(canvas);
    frame.appendChild(stage);
    body.appendChild(frame);
    shell.appendChild(body);
    backdrop.appendChild(shell);

    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop || event.target === stage) closeCanvasLayerOutputPreview();
    });

    const keydownHandler = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeCanvasLayerOutputPreview();
    };
    document.addEventListener("keydown", keydownHandler, true);

    document.body.appendChild(backdrop);
    canvasLayerOutputPreview = { root: backdrop, keydownHandler };
  }

  function closeCanvasLayerViewer() {
    canvasLayerDecompositionViewer?.root?.remove();
    canvasLayerDecompositionViewer = null;
  }

  function openCanvasLayerViewer(node, state) {
    if (!state || state.phase !== "succeeded") return;
    closeCanvasLayerDecompositionPanel();
    closeCanvasLayerOutputPreview();
    closeCanvasLayerViewer();
    const backdrop = canvasLayerDecompositionElement("div", "gala-layer-viewer-backdrop");
    backdrop.dataset.galaLayerViewer = "true";
    const shell = canvasLayerDecompositionElement("section", "gala-layer-viewer-shell");
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-labelledby", "gala-layer-viewer-title");
    backdrop.appendChild(shell);
    backdrop.addEventListener("pointerdown", (event) => {
      if (event.target === backdrop) closeCanvasLayerViewer();
    });
    document.body.appendChild(backdrop);
    canvasLayerDecompositionViewer = { root: backdrop, shell, node, state };
    shell.addEventListener("click", handleCanvasLayerViewerClick);
    renderCanvasLayerViewer(canvasLayerDecompositionViewer);
  }

  function handleCanvasLayerViewerClick(event) {
    const viewer = canvasLayerDecompositionViewer;
    if (!viewer) return;
    const target = event.target instanceof Element ? event.target : null;
    const selectLayer = target?.closest("[data-gala-layer-select]");
    if (selectLayer) {
      viewer.state.selectedLayerId = selectLayer.dataset.galaLayerSelect || viewer.state.selectedLayerId;
      renderCanvasLayerViewer(viewer);
      return;
    }
    const toggleVisibility = target?.closest("[data-gala-layer-visibility]");
    if (!toggleVisibility) return;
    const layerId = toggleVisibility.dataset.galaLayerVisibility;
    if (viewer.state.hiddenLayerIds.has(layerId)) viewer.state.hiddenLayerIds.delete(layerId);
    else viewer.state.hiddenLayerIds.add(layerId);
    renderCanvasLayerViewer(viewer);
  }

  function renderCanvasLayerViewer(viewer) {
    if (!viewer?.shell) return;
    const state = viewer.state;
    const selected = state.layers.find((layer) => layer.id === state.selectedLayerId) || state.layers[0];
    viewer.shell.replaceChildren();

    const header = canvasLayerDecompositionElement("header", "gala-layer-viewer-header");
    const heading = canvasLayerDecompositionElement("div", "gala-layer-viewer-heading");
    heading.appendChild(canvasLayerDecompositionElement("span", "gala-layer-decompose-eyebrow", "AI 拆层结果"));
    const viewerTitle = canvasLayerDecompositionElement("h2", "", "查看图层");
    viewerTitle.id = "gala-layer-viewer-title";
    heading.appendChild(viewerTitle);
    heading.appendChild(canvasLayerDecompositionElement("p", "", `${state.layers.length} 个图层 · 原图未修改`));
    const close = canvasLayerDecompositionElement("button", "gala-layer-decompose-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "关闭图层查看器");
    close.addEventListener("click", closeCanvasLayerViewer);
    header.append(heading, close);
    viewer.shell.appendChild(header);

    const body = canvasLayerDecompositionElement("div", "gala-layer-viewer-body");
    const list = canvasLayerDecompositionElement("aside", "gala-layer-viewer-list");
    list.appendChild(canvasLayerDecompositionElement("div", "gala-layer-viewer-section-label", "图层列表"));
    state.layers.forEach((layer, index) => {
      const row = canvasLayerDecompositionElement("div", `gala-layer-viewer-row${selected?.id === layer.id ? " is-selected" : ""}`);
      const select = canvasLayerDecompositionElement("button", "gala-layer-viewer-row-select");
      select.type = "button";
      select.dataset.galaLayerSelect = layer.id;
      select.appendChild(canvasLayerDecompositionElement("span", "gala-layer-viewer-index", String(index + 1).padStart(2, "0")));
      const rowCopy = canvasLayerDecompositionElement("span", "gala-layer-viewer-row-copy");
      rowCopy.appendChild(canvasLayerDecompositionElement("strong", "", layer.name));
      rowCopy.appendChild(canvasLayerDecompositionElement("small", "", `Z-${layer.zIndex}`));
      select.appendChild(rowCopy);
      const visibility = canvasLayerDecompositionElement(
        "button",
        "gala-layer-viewer-visibility",
        state.hiddenLayerIds.has(layer.id) ? "显示" : "隐藏",
      );
      visibility.type = "button";
      visibility.dataset.galaLayerVisibility = layer.id;
      visibility.setAttribute("aria-pressed", state.hiddenLayerIds.has(layer.id) ? "false" : "true");
      row.append(select, visibility);
      list.appendChild(row);
    });
    const stage = canvasLayerDecompositionElement("div", "gala-layer-viewer-stage");
    const stageImage = canvasLayerDecompositionElement("img");
    stageImage.src = state.source?.url || "";
    stageImage.alt = "拆层重组预览";
    stage.appendChild(stageImage);
    if (selected?.bbox && !state.hiddenLayerIds.has(selected.id)) {
      const bbox = canvasLayerDecompositionElement("div", "gala-layer-viewer-bbox");
      bbox.style.left = `${selected.bbox.x * 100}%`;
      bbox.style.top = `${selected.bbox.y * 100}%`;
      bbox.style.width = `${selected.bbox.width * 100}%`;
      bbox.style.height = `${selected.bbox.height * 100}%`;
      stage.appendChild(bbox);
    }
    body.appendChild(stage);
    body.appendChild(list);
    viewer.shell.appendChild(body);

    const footer = canvasLayerDecompositionElement("footer", "gala-layer-viewer-footer");
    const layerActions = canvasLayerDecompositionElement("div", "gala-layer-viewer-action-group gala-layer-viewer-layer-actions");
    layerActions.appendChild(canvasLayerDecompositionElement("span", "gala-layer-viewer-action-label", "提取"));
    const selectedExtracted = Boolean(selected && state.extractedLayerIds.has(selected.id));
    const extractCurrent = canvasLayerDecompositionElement(
      "button",
      "gala-layer-decompose-secondary",
      selectedExtracted ? "已提取" : "当前图层",
    );
    extractCurrent.type = "button";
    extractCurrent.disabled = selectedExtracted;
    extractCurrent.addEventListener("click", () => {
      const created = extractCanvasLayerToNode(viewer, selected);
      if (!created) return;
      closeCanvasLayerViewer();
      showAttachmentReviewToast(`已提取「${selected.name}」为图片节点`, "success");
    });
    const allExtracted = state.layers.every((layer) => state.extractedLayerIds.has(layer.id));
    const extractAll = canvasLayerDecompositionElement(
      "button",
      "gala-layer-decompose-secondary",
      allExtracted ? "已提取" : "全部图层",
    );
    extractAll.type = "button";
    extractAll.disabled = allExtracted;
    extractAll.addEventListener("click", () => {
      const created = expandAllCanvasLayersToNodes(viewer);
      const group = groupCanvasLayerDecompositionNodes(viewer);
      if (!group) return;
      state.expanded = true;
      ensureCanvasLayerDecompositionOutput(viewer.node, state);
      closeCanvasLayerViewer();
      showAttachmentReviewToast(
        created.length ? `已提取全部图层并归为输入组（${created.length} 个新节点）` : "全部图层已归为输入组",
        "success",
      );
    });
    layerActions.append(extractCurrent, extractAll);

    const downloadActions = canvasLayerDecompositionElement(
      "div",
      "gala-layer-viewer-action-group gala-layer-viewer-download-actions",
    );
    downloadActions.appendChild(canvasLayerDecompositionElement("span", "gala-layer-viewer-action-label", "下载全部图层"));
    const downloadPsd = canvasLayerDecompositionElement("button", "gala-layer-decompose-secondary", "PSD");
    downloadPsd.type = "button";
    downloadPsd.addEventListener("click", () => {
      showAttachmentReviewToast(`PSD 导出任务已创建（包含 ${state.layers.length} 个图层）`, "success");
    });
    const downloadPng = canvasLayerDecompositionElement("button", "gala-layer-decompose-secondary", "PNG");
    downloadPng.type = "button";
    downloadPng.addEventListener("click", () => {
      const link = document.createElement("a");
      link.href = state.source?.url || "";
      link.download = `${String(state.source?.name || "layer-output").replace(/\.[^.]+$/, "")}-all-layers.png`;
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
      showAttachmentReviewToast(`PNG 已下载（包含 ${state.layers.length} 个图层）`, "success");
    });
    downloadActions.append(downloadPsd, downloadPng);
    footer.append(layerActions, downloadActions);
    viewer.shell.appendChild(footer);

  }

  function setupCanvasLayerDecompositionPrototype() {
    if (getRouteName() !== "canvas") return;
    document.querySelectorAll(".canvas-node.image-node").forEach((node) => {
      if (!canvasLayerDecompositionCandidate(node)) return;
      const toolbar = node.querySelector(":scope > .media-node-toolbar") || node.querySelector(".media-node-toolbar");
      if (!toolbar) return;
      const state = canvasLayerDecompositionState(node);
      let trigger = toolbar.querySelector("[data-gala-layer-decomposition-trigger]");
      if (!trigger) {
        trigger = canvasLayerDecompositionElement("button", "media-node-toolbar-btn gala-layer-decompose-trigger");
        trigger.type = "button";
        trigger.dataset.galaLayerDecompositionTrigger = "true";
        trigger.title = "AI拆层";
        trigger.setAttribute("aria-label", "AI拆层");
        const icon = canvasLayerDecompositionCopyIcon(toolbar);
        if (icon) trigger.appendChild(icon);
        trigger.appendChild(canvasLayerDecompositionElement("span", "", "AI拆层"));
        trigger.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openCanvasLayerDecompositionPanel(node);
        });
        const download = Array.from(toolbar.querySelectorAll("button.media-node-toolbar-btn"))
          .find((button) => /下载/.test(cleanText(button.textContent)));
        if (download) toolbar.insertBefore(trigger, download);
        else toolbar.appendChild(trigger);
      }
      trigger.disabled = false;
      trigger.classList.toggle("is-running", state.phase === "running");
    });
    if (canvasLayerDecompositionPanel) positionCanvasLayerDecompositionPanel(canvasLayerDecompositionPanel);
    canvasLayerDecompositionOutputs.forEach((output) => {
      positionCanvasLayerDecompositionOutput(output);
      renderCanvasLayerDecompositionConnection(output);
    });
  }

  function applyCurrentPage() {
    installMediaPreviewBlankDismiss();
    setupPromptEditFormLayout();
    setupWorkflowLibraryLayout();
    setupWorkflowDetailActions();
    setupAccountPermissionsPrototype();
    setupEnhanceMultiUpload();
    setupAspectRatioOptionPreviews();
    setupPromptLibraryCards();
    setupPromptPreviewMetadata();
    setupWan30ModelChoices();
    setupCanvasUploadSourceModal();
    setupCanvasUploadNodePrototype();
    setupCanvasLayerDecompositionPrototype();
    setupCanvasMediaLimitStatus();
    setupCanvasWan30Inputs();
    setupCanvasFileCompatibility();
    setupCanvasPromptNodes();
    const context = findPageContext();
    if (!context) {
      activeContext = null;
      document.body.classList.remove("gala-generation-workspace");
      return;
    }

    activeContext = context;
    document.body.classList.add("gala-generation-workspace");
    document.body.dataset.galaPage = context.config.key;
    markWorkspace(context);
    ensureTaskToolbar(context);
    updateTaskToolbar(context);
    if (context.config.prompt) setupPrompt(context);
    if (context.config.key === "video") setupWan30VideoInput(context);
    if (context.config.key === "angle") setupAnglePrompt(context);
  }

  function scheduleApply() {
    if (applyFrame) return;
    applyFrame = window.requestAnimationFrame(() => {
      applyFrame = 0;
      applyCurrentPage();
    });
  }

  function bindGlobalEvents() {
    window.addEventListener("hashchange", scheduleApply);
    window.addEventListener("popstate", scheduleApply);
    document.addEventListener("pointerdown", (event) => {
      if (!mentionPopover) return;
      if (mentionPopover.node.contains(event.target) || mentionPopover.anchor === event.target) return;
      closeMentionPopover();
    }, true);
    document.addEventListener("pointerdown", (event) => {
      if (!wan30UrlPopover) return;
      if (wan30UrlPopover.node.contains(event.target) || wan30UrlPopover.anchor === event.target) return;
      closeWan30UrlPopover();
    }, true);
    document.addEventListener("pointerdown", (event) => {
      if (!promptAttachmentSourceMenu) return;
      if (promptAttachmentSourceMenu.node.contains(event.target) || promptAttachmentSourceMenu.anchor === event.target) return;
      closePromptAttachmentSourceMenu();
    }, true);
    document.addEventListener("pointerdown", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const field = target?.closest(".prompt-generation-field");
      if (field) activePromptModelField = field.classList.contains("prompt-generation-model-field") ? field : null;
    }, true);
    document.addEventListener("pointerdown", (event) => {
      if (getRouteName() !== "canvas") return;
      const target = event.target instanceof Element ? event.target : null;
      const node = target?.closest(".canvas-node.image-node");
      if (!node) return;
      if (target.closest(".blank-image")) {
        canvasUploadTargetNodeId = canvasUploadNodeId(node);
      // Keep the native upload-source dialog available here so users can
      // choose local upload or the project asset library before selecting a file.
        return;
      }
      if (target.closest("[data-gala-canvas-upload-slot]")) {
        canvasUploadTargetNodeId = canvasUploadNodeId(node);
      }
    }, true);
    document.addEventListener("change", (event) => {
      const input = event.target instanceof HTMLInputElement ? event.target : null;
      if (!input || input.type !== "file") return;
      if (input.dataset.galaCanvasUploadInput !== "true" && input !== findCanvasUploadInput()) return;
      captureCanvasUploadSelection(input, event);
    }, true);
    document.addEventListener("drop", (event) => {
      if (getRouteName() !== "canvas" || !event.dataTransfer?.files?.length) return;
      const files = Array.from(event.dataTransfer.files);
      if (!files.length) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const target = event.target instanceof Element
        ? event.target.closest(".canvas-node.image-node")
        : null;
      startCanvasPrototypeUpload(
        files,
        canvasUploadNodeId(target) || canvasUploadTargetNodeId,
      );
    }, true);
    document.addEventListener("click", togglePromptModelSelection, true);
    const openTypedMention = (event) => {
      const currentContext = findPageContext();
      if (!currentContext || !currentContext.config.prompt) return;
      const editor = getPromptEditor(currentContext);
      if (!editor || (event.target !== editor && !editor.contains(event.target))) return;
      const anchor = currentContext.input && currentContext.input.querySelector('[data-gala-prompt-action="mention"]');
      if (!anchor) return;
      window.requestAnimationFrame(() => {
        if (mentionPopover) return;
        const currentEditor = getPromptEditor(currentContext);
        if (!currentEditor || !promptText(currentEditor).endsWith("@")) return;
        openMentionPopover(currentContext, anchor);
      });
    };
    document.addEventListener("input", openTypedMention, true);
    document.addEventListener("keyup", openTypedMention, true);
    document.addEventListener("selectionchange", schedulePromptVariableSelectionCheck, true);
    document.addEventListener("select", schedulePromptVariableSelectionCheck, true);
    document.addEventListener("pointerdown", handlePromptVariablePointerDown, true);
    document.addEventListener("pointerup", handlePromptVariablePointerUp, true);
    document.addEventListener("pointercancel", handlePromptVariablePointerCancel, true);
    document.addEventListener("keyup", schedulePromptVariableSelectionCheck, true);
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (cancelPromptVariableModes()) {
        event.preventDefault();
        return;
      }
      if (wan30UrlPopover) closeWan30UrlPopover();
      else if (mentionPopover) closeMentionPopover();
      else if (promptAttachmentSourceMenu) closePromptAttachmentSourceMenu();
      else if (volcLibraryModal && !volcLibraryModal.backdrop.hidden) closeVolcLibraryModal();
      else if (canvasLayerDecompositionViewer) closeCanvasLayerViewer();
      else if (canvasLayerDecompositionPanel) closeCanvasLayerDecompositionPanel();
      else if (taskModal && !taskModal.backdrop.hidden) closeTaskModal();
    });

    const observer = new MutationObserver(() => scheduleApply());
    observer.observe(document.body, { childList: true, subtree: true });
    window.setInterval(scheduleApply, 1200);
  }

  installFetchInstrumentation();
  bindGlobalEvents();
  scheduleApply();
})();
