const MOCK = {
  stores: {
    A001: { name: "A 店", generalVisitors: "1,284", health: "正常", revenue: "103%", rank: "3 / 18" },
    B001: { name: "B 店", generalVisitors: "1,032", health: "正常", revenue: "97%", rank: "7 / 18" },
    C001: { name: "C 店", generalVisitors: "1,441", health: "注意", revenue: "108%", rank: "2 / 21" },
    D001: { name: "D 店", generalVisitors: "918", health: "正常", revenue: "94%", rank: "11 / 21" }
  },
  storeAccounts: {
    "store-a@example.com": { googleSubject: "GOOGLE-STORE-A", storeCode: "A001", label: "A 店門市 Google 帳號" }
  },
  users: {
    manager: { userId: "USER-001", email: "manager.wang@example.com", name: "王店長", role: "STORE_MANAGER", allowedStoreCodes: ["A001", "B001"] },
    advisor: { userId: "USER-002", email: "advisor.chen@example.com", name: "陳區顧問", role: "AREA_ADVISOR", allowedStoreCodes: ["A001", "B001", "C001", "D001"] },
    unauthorized: { userId: "USER-999", email: "other.user@example.com", name: "未授權公司使用者", role: "OTHER", allowedStoreCodes: [] }
  }
};

const MACHINE_SPEC = {
  id: "pcsc-analytic-login-reference",
  version: "0.3",
  runtime: {
    sample: "client-side/browser mock",
    productionRule: "server owns Device Binding, Human Identity and Authorization truth; data layer enforces row access"
  },
  principles: [
    "Store Google Account login is a binding ceremony, not the Device Binding itself",
    "Device Binding grants Store Context only",
    "Device Binding does not grant Human sensitive authorization",
    "logoutHuman() != unbindDevice()",
    "IDLE_TIMEOUT != unbindDevice()"
  ],
  initial: "BOOT",
  context: [
    "scenario",
    "deviceBinding",
    "storeContext",
    "humanSession",
    "authorization",
    "selectedStoreCode",
    "viewMode"
  ],
  states: {
    BOOT: {
      on: {
        DEVICE_BINDING_RESOLVED: "GENERAL_MODE",
        DEVICE_UNBOUND: "PERSONAL_ENTRY"
      }
    },
    PERSONAL_ENTRY: {
      on: {
        REQUEST_DEVICE_BIND: "STORE_ACCOUNT_AUTH_REQUIRED",
        REQUEST_SENSITIVE: "HUMAN_AUTH_REQUIRED"
      }
    },
    STORE_ACCOUNT_AUTH_REQUIRED: {
      on: {
        STORE_ACCOUNT_AUTH_SUCCESS: "RESOLVE_STORE_ACCOUNT",
        STORE_ACCOUNT_AUTH_FAIL: "PERSONAL_ENTRY"
      }
    },
    RESOLVE_STORE_ACCOUNT: {
      on: {
        DEVICE_BINDING_CREATED: "GENERAL_MODE",
        STORE_ACCOUNT_MAPPING_DENIED: "PERSONAL_ENTRY"
      }
    },
    GENERAL_MODE: {
      on: {
        REQUEST_SENSITIVE: [
          { target: "SENSITIVE_MODE", guard: "canEnterSensitiveMode" },
          { target: "HUMAN_AUTH_REQUIRED" }
        ],
        UNBIND_DEVICE: "PERSONAL_ENTRY_OR_SENSITIVE"
      }
    },
    HUMAN_AUTH_REQUIRED: {
      on: {
        AUTH_SUCCESS: "HUMAN_AUTHENTICATED"
      }
    },
    HUMAN_AUTHENTICATED: {
      on: {
        AUTHORIZATION_RESOLVED: "AUTHORIZATION_RESOLVED",
        AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED"
      }
    },
    AUTHORIZATION_RESOLVED: {
      on: {
        ENTER_SENSITIVE: { target: "SENSITIVE_MODE", guard: "selectedStoreAllowed" }
      }
    },
    AUTHORIZATION_DENIED: {
      on: {
        RETRY_HUMAN_AUTH: "HUMAN_AUTH_REQUIRED"
      }
    },
    SENSITIVE_MODE: {
      on: {
        CHANGE_STORE: { target: "SENSITIVE_MODE", guard: "requestedStoreAllowed" },
        VIEW_GENERAL: "GENERAL_MODE_OR_PERSONAL_ENTRY",
        HUMAN_LOGOUT: "GENERAL_MODE_OR_PERSONAL_ENTRY",
        IDLE_TIMEOUT: "GENERAL_MODE_OR_PERSONAL_ENTRY",
        UNBIND_DEVICE: "SENSITIVE_MODE_OR_PERSONAL_ENTRY"
      }
    },
    GENERAL_MODE_OR_PERSONAL_ENTRY: {
      pseudo: true,
      resolveBy: "deviceBinding.status === 'ACTIVE' ? GENERAL_MODE : PERSONAL_ENTRY"
    },
    SENSITIVE_MODE_OR_PERSONAL_ENTRY: {
      pseudo: true,
      resolveBy: "valid Human Session ? SENSITIVE_MODE : PERSONAL_ENTRY"
    }
  },
  guards: {
    deviceBindingActive: "deviceBinding.status === ACTIVE and server validates binding",
    canEnterSensitiveMode: "human authenticated AND authorization resolved AND selectedStoreCode in allowedStoreCodes",
    selectedStoreAllowed: "selectedStoreCode in allowedStoreCodes",
    requestedStoreAllowed: "requested store code in allowedStoreCodes"
  },
  adapters: {
    StoreAccountResolver: "verified store Google identity -> unique storeCode",
    StoreDeviceBindingProvider: "create / resolve / revoke persistent Store Device Binding",
    HumanIdentityProvider: "authenticate person and return stable human userId",
    AuthorizationProvider: "resolve role and allowedStoreCodes for authenticated human"
  }
};

const state = {
  flowState: "BOOT",
  scenario: "bound-store-a",
  deviceBinding: { status: "unknown", bindingId: null, storeCode: null, verifiedBy: null, persistent: false },
  storeContext: { status: "unknown", storeCode: null },
  humanSession: { status: "anonymous", userId: null, email: null, name: null },
  authorization: { status: "unresolved", role: null, allowedStoreCodes: [] },
  selectedStoreCode: null,
  viewMode: "general"
};

const $ = (id) => document.getElementById(id);
const storeLabel = (code) => code && MOCK.stores[code] ? `${MOCK.stores[code].name} (${code})` : "—";

function log(message) {
  const li = document.createElement("li");
  li.innerHTML = message;
  $("event-log").prepend(li);
}

function setMessage(text = "") {
  $("message").textContent = text;
  $("message").classList.toggle("hidden", !text);
}

function isDeviceBound() {
  return state.deviceBinding.status === "ACTIVE" && Boolean(state.deviceBinding.storeCode);
}

function resolveBaseFlowState() {
  return isDeviceBound() ? "GENERAL_MODE" : "PERSONAL_ENTRY";
}

function getGuardSnapshot() {
  const humanAuthenticated = state.humanSession.status === "authenticated";
  const authorizationResolved = state.authorization.status === "resolved";
  const selectedStoreAllowed = Boolean(
    state.selectedStoreCode &&
    state.authorization.allowedStoreCodes.includes(state.selectedStoreCode)
  );

  return {
    deviceBindingActive: isDeviceBound(),
    storeContextResolved: state.storeContext.status === "resolved",
    humanAuthenticated,
    authorizationResolved,
    selectedStoreAllowed,
    canEnterSensitiveMode: humanAuthenticated && authorizationResolved && selectedStoreAllowed,
    lifecycleInvariant: "Human logout/timeout clears Human Session only; only UNBIND_DEVICE changes Device Binding",
    productionReminder: "Browser state is demonstrative only. Server validates Device Binding/Human Session; Data Layer enforces requested_store_code in allowed_store_codes."
  };
}

function getRuntimeSnapshot() {
  return {
    flowState: state.flowState,
    runtimeLayer: "client-side/browser sample",
    scenario: state.scenario,
    deviceBinding: state.deviceBinding,
    storeContext: state.storeContext,
    humanSession: state.humanSession,
    authorization: state.authorization,
    selectedStoreCode: state.selectedStoreCode,
    viewMode: state.viewMode
  };
}

function renderInspector() {
  $("current-state-json").textContent = JSON.stringify(getRuntimeSnapshot(), null, 2);
  $("machine-spec-json").textContent = JSON.stringify(MACHINE_SPEC, null, 2);
  $("guard-state-json").textContent = JSON.stringify(getGuardSnapshot(), null, 2);
}

function resetHuman() {
  state.humanSession = { status: "anonymous", userId: null, email: null, name: null };
  state.authorization = { status: "unresolved", role: null, allowedStoreCodes: [] };
  state.selectedStoreCode = state.storeContext.storeCode;
  state.viewMode = "general";
}

function applyBoundStoreA() {
  const account = MOCK.storeAccounts["store-a@example.com"];
  state.deviceBinding = {
    status: "ACTIVE",
    bindingId: "DEVICE-BIND-MOCK-A001",
    storeCode: account.storeCode,
    verifiedBy: account.email || "store-a@example.com",
    persistent: true
  };
  state.storeContext = { status: "resolved", storeCode: account.storeCode };
  state.selectedStoreCode = account.storeCode;
}

function applyUnboundDevice() {
  state.deviceBinding = { status: "NONE", bindingId: null, storeCode: null, verifiedBy: null, persistent: false };
  state.storeContext = { status: "none", storeCode: null };
  if (state.humanSession.status !== "authenticated") state.selectedStoreCode = null;
}

function boot(scenario) {
  state.flowState = "BOOT";
  state.scenario = scenario;
  state.deviceBinding = { status: "unknown", bindingId: null, storeCode: null, verifiedBy: null, persistent: false };
  state.storeContext = { status: "unknown", storeCode: null };
  resetHuman();
  setMessage();
  log(`<code>BOOT</code> → RESOLVE_DEVICE_BINDING`);

  if (scenario === "bound-store-a") {
    applyBoundStoreA();
    state.flowState = "GENERAL_MODE";
    log(`StoreDeviceBindingProvider → <code>DEVICE-BIND-MOCK-A001</code>`);
    log(`<code>DEVICE_BINDING_RESOLVED</code> → Store Context=A001 → GENERAL_MODE`);
  } else {
    applyUnboundDevice();
    state.flowState = "PERSONAL_ENTRY";
    log(`StoreDeviceBindingProvider → <code>NONE</code>`);
    log(`<code>DEVICE_UNBOUND</code> → PERSONAL_ENTRY`);
  }
  render();
}

function bindDeviceToStoreA() {
  const accountEmail = "store-a@example.com";
  const account = MOCK.storeAccounts[accountEmail];

  state.flowState = "STORE_ACCOUNT_AUTH_REQUIRED";
  log(`<code>REQUEST_DEVICE_BIND</code> → STORE_ACCOUNT_AUTH_REQUIRED`);
  log(`Google Workspace Store Account Auth (Mock) → <code>${accountEmail}</code>`);
  log(`<code>STORE_ACCOUNT_AUTH_SUCCESS</code> → RESOLVE_STORE_ACCOUNT`);
  log(`StoreAccountResolver → <code>${accountEmail}</code> → <code>${account.storeCode}</code>`);

  state.deviceBinding = {
    status: "ACTIVE",
    bindingId: "DEVICE-BIND-MOCK-A001",
    storeCode: account.storeCode,
    verifiedBy: accountEmail,
    persistent: true
  };
  state.storeContext = { status: "resolved", storeCode: account.storeCode };
  state.selectedStoreCode = account.storeCode;
  state.viewMode = "general";
  state.flowState = "GENERAL_MODE";

  log(`<code>DEVICE_BINDING_CREATED</code> → DEVICE-BIND-MOCK-A001`);
  log(`verified Store Context → <code>${account.storeCode}</code> → GENERAL_MODE`);
  setMessage("此裝置已用 A 店門市 Google 帳號完成 Mock Binding。之後 Human Logout 不會解除這個 Binding。");
  render();
}

function unbindDevice() {
  const oldBinding = state.deviceBinding.bindingId;
  applyUnboundDevice();
  log(`<code>UNBIND_DEVICE</code> → revoke ${oldBinding || "binding"}`);
  log(`verified Store Context → <code>none</code>`);
  setMessage("已模擬解除門市 Device Binding。這是獨立操作，不是 Human Logout。" );

  if (getGuardSnapshot().canEnterSensitiveMode) {
    state.flowState = "SENSITIVE_MODE";
    state.viewMode = "sensitive";
  } else {
    state.flowState = "PERSONAL_ENTRY";
    state.viewMode = "general";
    state.selectedStoreCode = null;
  }
  render();
}

function beginSensitiveFlow() {
  if (getGuardSnapshot().canEnterSensitiveMode) {
    enterSensitiveMode();
    return;
  }
  state.flowState = "HUMAN_AUTH_REQUIRED";
  $("human-panel").classList.remove("hidden");
  setMessage("請先完成個人身分驗證。這個 Human Session 與門市 Device Binding 是不同生命週期。" );
  log(`<code>REQUEST_SENSITIVE</code> → HUMAN_AUTH_REQUIRED`);
  render();
}

function authenticate(key) {
  const user = MOCK.users[key];
  state.humanSession = { status: "authenticated", userId: user.userId, email: user.email, name: user.name };
  state.flowState = "HUMAN_AUTHENTICATED";
  log(`HumanIdentityProvider → <code>${user.userId}</code> (${user.name})`);
  log(`<code>AUTH_SUCCESS</code> → HUMAN_AUTHENTICATED`);

  state.authorization = { status: "resolved", role: user.role, allowedStoreCodes: [...user.allowedStoreCodes] };
  log(`AuthorizationProvider → <code>${user.role}</code>, stores=[${user.allowedStoreCodes.join(", ")}]`);

  if (!user.allowedStoreCodes.length) {
    state.flowState = "AUTHORIZATION_DENIED";
    state.viewMode = "general";
    state.selectedStoreCode = state.storeContext.storeCode;
    setMessage("個人身分驗證成功，但沒有任何機敏門市授權。Google / SSO 登入成功不等於具有報表權限。" );
    log(`<code>AUTHORIZATION_DENIED</code>`);
    render();
    return;
  }

  state.flowState = "AUTHORIZATION_RESOLVED";
  log(`<code>AUTHORIZATION_RESOLVED</code>`);

  if (state.storeContext.storeCode && user.allowedStoreCodes.includes(state.storeContext.storeCode)) {
    state.selectedStoreCode = state.storeContext.storeCode;
    log(`Selected Store default → bound Store Context <code>${state.selectedStoreCode}</code>`);
  } else if (user.allowedStoreCodes.length === 1) {
    state.selectedStoreCode = user.allowedStoreCodes[0];
  } else {
    state.selectedStoreCode = user.allowedStoreCodes[0];
    log(`No usable Store Context → sample defaults first authorized store <code>${state.selectedStoreCode}</code>`);
  }

  enterSensitiveMode();
}

function enterSensitiveMode() {
  if (!getGuardSnapshot().canEnterSensitiveMode) {
    setMessage("Sensitive Mode Guard 拒絕進入。請確認 Human Identity、Authorization 與 Selected Store。" );
    render();
    return;
  }
  state.flowState = "SENSITIVE_MODE";
  state.viewMode = "sensitive";
  setMessage();
  log(`<code>ENTER_SENSITIVE</code> → SENSITIVE_MODE (${state.selectedStoreCode})`);
  render();
}

function navigateGeneral() {
  state.viewMode = "general";
  state.flowState = resolveBaseFlowState();
  log(`<code>VIEW_GENERAL</code> → ${state.flowState}`);
  render();
}

function logoutHuman(reason = "manual logout") {
  const keptBinding = state.deviceBinding.bindingId;
  const keptStore = state.storeContext.storeCode;
  resetHuman();
  state.flowState = resolveBaseFlowState();
  log(`clear Human Identity + Authorization (${reason})`);
  if (isDeviceBound()) {
    log(`KEEP Device Binding=<code>${keptBinding}</code>`);
    log(`KEEP Store Context=<code>${keptStore}</code> → GENERAL_MODE`);
  } else {
    log(`Device Binding remains <code>NONE</code> → PERSONAL_ENTRY`);
  }
  setMessage(
    reason === "idle timeout"
      ? "Human Sensitive Session 已 Timeout；門市 Device Binding 不變。"
      : "已退出 Human Session；門市 Device Binding 不變。"
  );
  render();
}

function changeSelectedStore(code) {
  if (!state.authorization.allowedStoreCodes.includes(code)) {
    setMessage("拒絕切換：Selected Store 不在 Allowed Stores。正式環境後端亦須再次驗證。" );
    log(`<code>DENY</code> unauthorized selectedStore=${code}`);
    render();
    return;
  }
  state.selectedStoreCode = code;
  state.flowState = "SENSITIVE_MODE";
  log(`<code>CHANGE_STORE</code> → ${code}`);
  render();
}

function switchInspectorTab(tab) {
  document.querySelectorAll("[data-inspector-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.inspectorTab === tab);
  });
  document.querySelectorAll("[data-inspector-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.inspectorPanel !== tab);
  });
}

function render() {
  $("flow-context").textContent = state.flowState;
  $("binding-context").textContent = isDeviceBound() ? `${state.deviceBinding.storeCode} · ACTIVE` : "UNBOUND";
  $("store-context").textContent = state.storeContext.status === "resolved" ? storeLabel(state.storeContext.storeCode) : "None";
  $("human-context").textContent = state.humanSession.status === "authenticated" ? `${state.humanSession.name}` : "Anonymous";
  $("auth-context").textContent = state.authorization.status === "resolved" ? `${state.authorization.role} · ${state.authorization.allowedStoreCodes.length} 店` : "Unresolved";
  $("selected-context").textContent = storeLabel(state.selectedStoreCode);

  document.querySelectorAll("[data-scenario]").forEach((b) => b.classList.toggle("active", b.dataset.scenario === state.scenario));
  $("general-nav").classList.toggle("active", state.viewMode === "general");
  $("sensitive-nav").classList.toggle("active", state.viewMode === "sensitive");
  $("general-view").classList.toggle("hidden", state.viewMode !== "general");
  $("sensitive-view").classList.toggle("hidden", state.viewMode !== "sensitive");
  $("logout-human").classList.toggle("hidden", state.humanSession.status !== "authenticated");
  $("unbind-device").classList.toggle("hidden", !isDeviceBound());

  const hasStore = state.storeContext.status === "resolved";
  $("general-empty").classList.toggle("hidden", hasStore);
  $("general-data").classList.toggle("hidden", !hasStore);
  $("general-title").textContent = hasStore ? `${storeLabel(state.storeContext.storeCode)} 一般門市報表` : "尚未綁定門市裝置";

  if (hasStore) {
    const store = MOCK.stores[state.storeContext.storeCode];
    const cards = $("general-data").querySelectorAll(".metric-card strong");
    cards[0].textContent = store.generalVisitors;
    cards[1].textContent = store.health;
  }

  if (state.viewMode === "sensitive") {
    $("human-panel").classList.add("hidden");
    const select = $("store-select");
    select.innerHTML = "";
    state.authorization.allowedStoreCodes.forEach((code) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = storeLabel(code);
      option.selected = code === state.selectedStoreCode;
      select.appendChild(option);
    });
    $("role-chip").textContent = state.authorization.role;
    const store = MOCK.stores[state.selectedStoreCode];
    $("sensitive-metric-1").textContent = store.revenue;
    $("sensitive-metric-2").textContent = store.rank;
    $("authorization-explain").textContent = `${state.humanSession.name} 的 Allowed Stores：${state.authorization.allowedStoreCodes.map(storeLabel).join("、")}。Device Binding=${isDeviceBound() ? storeLabel(state.deviceBinding.storeCode) : "NONE"}；目前 Selected Store=${storeLabel(state.selectedStoreCode)}。Device Binding 不授予機敏權限。`;
  }

  renderInspector();
}

document.querySelectorAll("[data-scenario]").forEach((button) => button.addEventListener("click", () => boot(button.dataset.scenario)));
document.querySelectorAll("[data-user]").forEach((button) => button.addEventListener("click", () => authenticate(button.dataset.user)));
document.querySelectorAll("[data-inspector-tab]").forEach((button) => button.addEventListener("click", () => switchInspectorTab(button.dataset.inspectorTab)));
$("bind-store-a").addEventListener("click", bindDeviceToStoreA);
$("unbind-device").addEventListener("click", unbindDevice);
$("sensitive-nav").addEventListener("click", beginSensitiveFlow);
$("personal-login-cta").addEventListener("click", beginSensitiveFlow);
$("general-nav").addEventListener("click", navigateGeneral);
$("logout-human").addEventListener("click", () => logoutHuman("manual logout"));
$("simulate-timeout").addEventListener("click", () => logoutHuman("idle timeout"));
$("store-select").addEventListener("change", (e) => changeSelectedStore(e.target.value));
$("clear-log").addEventListener("click", () => { $("event-log").innerHTML = ""; });

boot("bound-store-a");
