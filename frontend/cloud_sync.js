/* Finance AI — Cloud sync bidirecional
 *
 * Dois provedores suportados (escolha do usuário):
 *   - JSONBin.io: grátis, sem cadastro (chave X-Master-Key opcional)
 *   - GitHub Gist: usuário fornece Personal Access Token (scope "gist")
 *
 * Cada workspace tem:
 *   - id (UUID)
 *   - provider ("jsonbin" | "gist")
 *   - credentials (bin id / gist id + tokens)
 *   - last_sync_at
 *
 * Estratégia: last-writer-wins por arquivo (o dado todo). Hash para evitar reupload.
 */

const WS_KEY = "fa_v3_workspace";

function loadWs() {
  try { return JSON.parse(localStorage.getItem(WS_KEY)) || null; } catch { return null; }
}
function saveWs(w) {
  if (w) localStorage.setItem(WS_KEY, JSON.stringify(w));
  else localStorage.removeItem(WS_KEY);
}

function hashOf(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h.toString(36);
}

/* ============ JSONBin.io ============ */
const JSONBIN_BASE = "https://api.jsonbin.io/v3/b";
async function jsonbinCreate(payload, masterKey) {
  const headers = { "Content-Type": "application/json", "X-Bin-Private": "true", "X-Bin-Name": "finance-ai" };
  if (masterKey) headers["X-Master-Key"] = masterKey;
  const res = await fetch(JSONBIN_BASE, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).metadata.id;
}
async function jsonbinUpdate(id, payload, masterKey) {
  const headers = { "Content-Type": "application/json" };
  if (masterKey) headers["X-Master-Key"] = masterKey;
  const res = await fetch(`${JSONBIN_BASE}/${id}`, { method: "PUT", headers, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(await res.text());
}
async function jsonbinGet(id, masterKey) {
  const headers = {};
  if (masterKey) headers["X-Master-Key"] = masterKey;
  const res = await fetch(`${JSONBIN_BASE}/${id}/latest`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).record;
}

/* ============ GitHub Gist ============ */
const GIST_BASE = "https://api.github.com/gists";
async function gistCreate(payload, token) {
  const res = await fetch(GIST_BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      description: "Finance AI workspace",
      public: false,
      files: { "data.json": { content: JSON.stringify(payload) } }
    })
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).id;
}
async function gistUpdate(id, payload, token) {
  const res = await fetch(`${GIST_BASE}/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ files: { "data.json": { content: JSON.stringify(payload) } } })
  });
  if (!res.ok) throw new Error(await res.text());
}
async function gistGet(id, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${GIST_BASE}/${id}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  const content = (await res.json()).files["data.json"]?.content || "{}";
  return JSON.parse(content);
}

/* ============ Operações do workspace ============ */
function currentPayload() {
  if (!Store.currentUserId) return null;
  return {
    version: 3,
    updated_at: new Date().toISOString(),
    user: { email: Store.user.email, name: Store.user.name },
    data: Store.data
  };
}

async function push() {
  const ws = loadWs(); if (!ws) throw new Error("Workspace não configurado");
  const payload = currentPayload();
  const serialized = JSON.stringify(payload);
  if (ws.lastHash === hashOf(serialized)) return { skipped: true };

  if (ws.provider === "jsonbin") {
    await jsonbinUpdate(ws.bin_id, payload, ws.key || null);
  } else if (ws.provider === "gist") {
    await gistUpdate(ws.gist_id, payload, ws.token);
  }
  ws.lastHash = hashOf(serialized);
  ws.last_sync_at = new Date().toISOString();
  saveWs(ws);
  return { pushed: true };
}

async function pull() {
  const ws = loadWs(); if (!ws) throw new Error("Workspace não configurado");
  let payload;
  if (ws.provider === "jsonbin") {
    payload = await jsonbinGet(ws.bin_id, ws.key || null);
  } else if (ws.provider === "gist") {
    payload = await gistGet(ws.gist_id, ws.token || null);
  }
  if (!payload?.data) throw new Error("Workspace vazio ou corrompido");

  // Merge: substitui localmente (last-writer-wins)
  Store.db.data[Store.currentUserId] = payload.data;
  Store._save();
  ws.lastHash = hashOf(JSON.stringify(currentPayload()));
  ws.last_sync_at = new Date().toISOString();
  saveWs(ws);
  return { pulled: true, updated_at: payload.updated_at };
}

async function initJsonbin({ key }) {
  const payload = currentPayload();
  const bin_id = await jsonbinCreate(payload, key || null);
  const ws = {
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    provider: "jsonbin", bin_id, key: key || null,
    lastHash: hashOf(JSON.stringify(payload)),
    last_sync_at: new Date().toISOString()
  };
  saveWs(ws);
  return ws;
}

async function initGist({ token }) {
  if (!token) throw new Error("Token GitHub (scope 'gist') obrigatório");
  const payload = currentPayload();
  const gist_id = await gistCreate(payload, token);
  const ws = {
    id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    provider: "gist", gist_id, token,
    lastHash: hashOf(JSON.stringify(payload)),
    last_sync_at: new Date().toISOString()
  };
  saveWs(ws);
  return ws;
}

async function joinWorkspace(link) {
  // link: fa://ws/{provider}/{id}?k={key|token}
  const m = link.match(/fa:\/\/ws\/(jsonbin|gist)\/([^?]+)(?:\?k=(.+))?/);
  if (!m) throw new Error("Link inválido");
  const [, provider, id, key] = m;
  const ws = { id: crypto.randomUUID(), provider, last_sync_at: null, lastHash: null };
  if (provider === "jsonbin") { ws.bin_id = id; ws.key = key || null; }
  else { ws.gist_id = id; ws.token = key || null; }
  saveWs(ws);
  await pull();
  return ws;
}

function shareLink() {
  const ws = loadWs(); if (!ws) return null;
  if (ws.provider === "jsonbin")
    return `fa://ws/jsonbin/${ws.bin_id}${ws.key ? `?k=${encodeURIComponent(ws.key)}` : ""}`;
  if (ws.provider === "gist")
    return `fa://ws/gist/${ws.gist_id}${ws.token ? `?k=${encodeURIComponent(ws.token)}` : ""}`;
}

function disconnect() { saveWs(null); }
function info() { return loadWs(); }

let autoSyncTimer = null;
function enableAutoSync(intervalMs = 1000 * 60 * 5) {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = setInterval(() => {
    if (!loadWs()) return;
    push().catch(() => {});
  }, intervalMs);
}

window.Cloud = { initJsonbin, initGist, push, pull, shareLink, joinWorkspace, disconnect, info, enableAutoSync };
