const MOCK = {
  stores: {
    A001: { name: "A 店", generalVisitors: "1,284", health: "正常", revenue: "103%", rank: "3 / 18" },
    B001: { name: "B 店", generalVisitors: "1,032", health: "正常", revenue: "97%", rank: "7 / 18" },
    C001: { name: "C 店", generalVisitors: "1,441", health: "注意", revenue: "108%", rank: "2 / 21" },
    D001: { name: "D 店", generalVisitors: "918", health: "正常", revenue: "94%", rank: "11 / 21" }
  },
  users: {
    manager: { userId: "USER-001", email: "manager.wang@example.com", name: "王店長", role: "STORE_MANAGER", allowedStoreCodes: ["A001", "B001"] },
    advisor: { userId: "USER-002", email: "advisor.chen@example.com", name: "陳區顧問", role: "AREA_ADVISOR", allowedStoreCodes: ["A001", "B001", "C001", "D001"] },
    unauthorized: { userId: "USER-999", email: "other.user@example.com", name: "未授權公司使用者", role: "OTHER", allowedStoreCodes: [] }
  }
};

const state = {
  scenario: "store-a",
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

function resetHuman() {
  state.humanSession = { status: "anonymous", userId: null, email: null, name: null };
  state.authorization = { status: "unresolved", role: null, allowedStoreCodes: [] };
  state.selectedStoreCode = state.storeContext.storeCode;
  state.viewMode = state.storeContext.status === "resolved" ? "general" : "general";
}

function boot(scenario) {
  state.scenario = scenario;
  state.storeContext = { status: "unknown", storeCode: null };
  resetHuman();
  setMessage();
  log(`<code>BOOT</code> → resolveStoreContext()`);

  if (scenario === "store-a") {
    state.storeContext = { status: "resolved", storeCode: "A001" };
    state.selectedStoreCode = "A001";
    log(`StoreIdentityProvider → <code>A001</code>`);
  } else {
    state.storeContext = { status: "none", storeCode: null };
    state.selectedStoreCode = null;
    log(`StoreIdentityProvider → <code>none</code>`);
  }
  render();
}

function beginSensitiveFlow() {
  if (state.humanSession.status === "authenticated" && state.authorization.status === "resolved") {
    enterSensitiveMode();
    return;
  }
  $("human-panel").classList.remove("hidden");
  setMessage("請先完成個人身分驗證。此處為 Mock；正式環境由企業 SSO Adapter 取代。");
  log(`<code>GENERAL/PERSONAL_ENTRY</code> → HUMAN_AUTH_REQUIRED`);
}

function authenticate(key) {
  const user = MOCK.users[key];
  state.humanSession = { status: "authenticated", userId: user.userId, email: user.email, name: user.name };
  state.authorization = { status: "resolved", role: user.role, allowedStoreCodes: [...user.allowedStoreCodes] };
  log(`HumanIdentityProvider → <code>${user.userId}</code> (${user.name})`);
  log(`AuthorizationProvider → <code>${user.role}</code>, stores=[${user.allowedStoreCodes.join(", ")}]`);

  if (!user.allowedStoreCodes.length) {
    state.viewMode = "general";
    state.selectedStoreCode = state.storeContext.storeCode;
    setMessage("個人身分驗證成功，但沒有任何機敏門市授權。Google / SSO 登入成功不等於具有報表權限。");
    log(`<code>AUTHORIZATION_DENIED</code>`);
    render();
    return;
  }

  if (state.storeContext.storeCode && user.allowedStoreCodes.includes(state.storeContext.storeCode)) {
    state.selectedStoreCode = state.storeContext.storeCode;
    log(`Selected Store default → current Store Context <code>${state.selectedStoreCode}</code>`);
  } else if (user.allowedStoreCodes.length === 1) {
    state.selectedStoreCode = user.allowedStoreCodes[0];
  } else {
    state.selectedStoreCode = user.allowedStoreCodes[0];
    log(`No usable Store Context → default first authorized store <code>${state.selectedStoreCode}</code> for sample UX`);
  }

  enterSensitiveMode();
}

function enterSensitiveMode() {
  const allowed = state.humanSession.status === "authenticated" &&
    state.authorization.status === "resolved" &&
    state.selectedStoreCode &&
    state.authorization.allowedStoreCodes.includes(state.selectedStoreCode);

  if (!allowed) {
    setMessage("Sensitive Mode Guard 拒絕進入。請確認 Human Identity、Authorization 與 Selected Store。");
    return;
  }
  state.viewMode = "sensitive";
  setMessage();
  log(`<code>SENSITIVE_MODE</code> → ${state.selectedStoreCode}`);
  render();
}

function logoutHuman(reason = "manual logout") {
  const keptStore = state.storeContext.storeCode;
  resetHuman();
  log(`clear Human Identity + Authorization (${reason})`);
  if (keptStore) {
    log(`keep Store Context=<code>${keptStore}</code> → GENERAL_MODE`);
  } else {
    log(`no Store Context → PERSONAL_ENTRY`);
  }
  setMessage(reason === "idle timeout" ? "個人機敏 Session 已 Timeout；門市 Context 保留。" : "已退出個人身分。門市 Context 不受影響。");
  render();
}

function changeSelectedStore(code) {
  if (!state.authorization.allowedStoreCodes.includes(code)) {
    setMessage("拒絕切換：Selected Store 不在 Allowed Stores。正式環境後端亦須再次驗證。");
    log(`<code>DENY</code> unauthorized selectedStore=${code}`);
    return;
  }
  state.selectedStoreCode = code;
  log(`Selected Store → <code>${code}</code>`);
  render();
}

function render() {
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

  const hasStore = state.storeContext.status === "resolved";
  $("general-empty").classList.toggle("hidden", hasStore);
  $("general-data").classList.toggle("hidden", !hasStore);
  $("general-title").textContent = hasStore ? `${storeLabel(state.storeContext.storeCode)} 一般門市報表` : "一般門市報表";

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
    $("authorization-explain").textContent = `${state.humanSession.name} 的 Allowed Stores：${state.authorization.allowedStoreCodes.map(storeLabel).join("、")}。目前 Selected Store=${storeLabel(state.selectedStoreCode)}。此頁數字皆為 Mock；正式資料應由受後端權限保護的 BI / Data Layer 提供。`;
  }
}

document.querySelectorAll("[data-scenario]").forEach((button) => button.addEventListener("click", () => boot(button.dataset.scenario)));
document.querySelectorAll("[data-user]").forEach((button) => button.addEventListener("click", () => authenticate(button.dataset.user)));
$("sensitive-nav").addEventListener("click", beginSensitiveFlow);
$("personal-login-cta").addEventListener("click", beginSensitiveFlow);
$("general-nav").addEventListener("click", () => { state.viewMode = "general"; render(); });
$("logout-human").addEventListener("click", () => logoutHuman("manual logout"));
$("simulate-timeout").addEventListener("click", () => logoutHuman("idle timeout"));
$("store-select").addEventListener("change", (e) => changeSelectedStore(e.target.value));
$("clear-log").addEventListener("click", () => { $("event-log").innerHTML = ""; });

boot("store-a");
