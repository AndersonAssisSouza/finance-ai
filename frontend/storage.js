/**
 * Camada de storage dual:
 * - Se houver backend FastAPI acessível -> usa API
 * - Caso contrário -> usa localStorage (modo offline, roda no GitHub Pages)
 *
 * Mesma interface para o index.html, independente do modo.
 */

class LocalStore {
  constructor() {
    this.mode = "local";
    this._load();
  }
  _load() {
    this.users        = JSON.parse(localStorage.getItem("fa_users")        || "{}");
    this.sessions     = JSON.parse(localStorage.getItem("fa_sessions")     || "{}");
    this.transactions = JSON.parse(localStorage.getItem("fa_transactions") || "[]");
    this.goals        = JSON.parse(localStorage.getItem("fa_goals")        || "[]");
    this.rules        = JSON.parse(localStorage.getItem("fa_rules")        || "[]");
    this.currentUser  = localStorage.getItem("fa_current_user") || null;
  }
  _save() {
    localStorage.setItem("fa_users",        JSON.stringify(this.users));
    localStorage.setItem("fa_sessions",     JSON.stringify(this.sessions));
    localStorage.setItem("fa_transactions", JSON.stringify(this.transactions));
    localStorage.setItem("fa_goals",        JSON.stringify(this.goals));
    localStorage.setItem("fa_rules",        JSON.stringify(this.rules));
    if (this.currentUser) localStorage.setItem("fa_current_user", this.currentUser);
  }
  _uid() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2); }
  _hash(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h<<5)-h) + s.charCodeAt(i); h|=0; } return "h" + h; }
  _userTx() { return this.transactions.filter(t => t.user_id === this.currentUser); }
  _userGoals() { return this.goals.filter(g => g.user_id === this.currentUser); }
  _userRules() { return this.rules.filter(r => r.user_id === this.currentUser); }

  async register({ email, password, name }) {
    if (this.users[email]) throw new Error("Email já cadastrado");
    const id = this._uid();
    this.users[email] = { id, email, password: this._hash(password), name: name || email.split("@")[0] };
    this.currentUser = id;
    const token = "local-" + id;
    this.sessions[token] = id;
    this._save();
    return { ok: true, token, user: { email, name: this.users[email].name } };
  }
  async login({ email, password }) {
    const u = this.users[email];
    if (!u || u.password !== this._hash(password)) throw new Error("Credenciais inválidas");
    this.currentUser = u.id;
    const token = "local-" + u.id;
    this.sessions[token] = u.id;
    this._save();
    return { token, user: { email: u.email, name: u.name } };
  }
  async me(token) {
    const uid = this.sessions[token];
    if (!uid) throw new Error("401");
    this.currentUser = uid;
    this._save();
    const u = Object.values(this.users).find(x => x.id === uid);
    return { email: u.email, name: u.name };
  }
  async listTransactions(limit = 200) {
    return this._userTx()
      .sort((a,b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }
  async createTransaction({ description, amount, date, category }) {
    const userRules = this._userRules();
    const tx = {
      id: this._uid(),
      user_id: this.currentUser,
      description,
      amount: parseFloat(amount),
      date: date || new Date().toISOString().slice(0, 10),
      category: category || FinanceAI.categorize(description, parseFloat(amount), userRules),
      is_recurring: false,
      source: "manual"
    };
    this.transactions.push(tx);
    this._save();
    return { ok: true, id: tx.id };
  }
  async deleteTransaction(id) {
    this.transactions = this.transactions.filter(t => !(t.id === id && t.user_id === this.currentUser));
    this._save();
    return { ok: true };
  }
  async dashboard() {
    const txs = this._userTx();
    const rules = this._userRules();
    const result = FinanceAI.consolidate(txs, rules);
    this._save();
    const goals = this._userGoals().map(g => ({
      ...g,
      target: g.target_amount,
      current: g.current_amount || 0,
      progress: Math.round((g.current_amount || 0) / g.target_amount * 1000) / 10
    }));
    const u = Object.values(this.users).find(x => x.id === this.currentUser);
    return { ...result, goals, user: { email: u.email, name: u.name } };
  }
  async listGoals() {
    return this._userGoals();
  }
  async createGoal({ name, target_amount, deadline }) {
    const g = {
      id: this._uid(),
      user_id: this.currentUser,
      name,
      target_amount: parseFloat(target_amount),
      current_amount: 0,
      deadline: deadline || null
    };
    this.goals.push(g);
    this._save();
    return { ok: true, id: g.id };
  }
  async deleteGoal(id) {
    this.goals = this.goals.filter(g => !(g.id === id && g.user_id === this.currentUser));
    this._save();
    return { ok: true };
  }
  async listRules() {
    return this._userRules();
  }
  async createRule({ keyword, category }) {
    const r = { id: this._uid(), user_id: this.currentUser, keyword, category };
    this.rules.push(r);
    this._save();
    return { ok: true, id: r.id };
  }
  async deleteRule(id) {
    this.rules = this.rules.filter(r => !(r.id === id && r.user_id === this.currentUser));
    this._save();
    return { ok: true };
  }
  async seedDemo() {
    this.transactions = this.transactions.filter(t => t.user_id !== this.currentUser);
    const today = new Date();
    const mkDate = d => { const x = new Date(today); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };
    const samples = [
      ["Salário mensal", 8500, 0],
      ["Aluguel apartamento", -2200, 2],
      ["iFood almoço", -45, 1],
      ["Uber para reunião", -28, 3],
      ["Supermercado Pão de Açúcar", -420, 5],
      ["Netflix assinatura", -55, 7],
      ["Spotify Premium", -22, 7],
      ["Farmácia Drogasil", -85, 8],
      ["Posto Shell gasolina", -180, 10],
      ["Shopee compras", -230, 12],
      ["Conta de luz", -195, 15],
      ["Conta de internet Vivo", -110, 15],
      ["iFood jantar", -62, 16],
      ["Amazon livros", -140, 18],
      ["Restaurante Outback", -240, 20],
      ["Salário mensal", 8500, 30],
      ["Aluguel apartamento", -2200, 32],
      ["iFood almoço", -48, 31],
      ["Netflix assinatura", -55, 37],
      ["Spotify Premium", -22, 37],
      ["Rendimento CDB", 320, 35],
    ];
    const userRules = this._userRules();
    for (const [desc, amt, days] of samples) {
      this.transactions.push({
        id: this._uid(),
        user_id: this.currentUser,
        description: desc,
        amount: amt,
        date: mkDate(days),
        category: FinanceAI.categorize(desc, amt, userRules),
        is_recurring: false,
        source: "demo"
      });
    }
    this._save();
    return { ok: true, imported: samples.length };
  }
  logout() {
    this.currentUser = null;
    localStorage.removeItem("fa_current_user");
  }
}


class ApiStore {
  constructor(base, token) {
    this.mode = "api";
    this.base = base;
    this.token = token;
  }
  async _req(path, opts = {}) {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(this.base + path, { ...opts, headers });
    if (!res.ok) {
      if (res.status === 401) { this.token = ""; localStorage.removeItem("fa_token"); }
      const t = await res.text();
      throw new Error(t || res.statusText);
    }
    return res.json();
  }
  async register(data) { const r = await this._req("/auth/register", { method:"POST", body: JSON.stringify(data) }); this.token = r.token; return r; }
  async login(data)    { const r = await this._req("/auth/login",    { method:"POST", body: JSON.stringify(data) }); this.token = r.token; return r; }
  async me()           { return this._req("/me"); }
  async listTransactions(limit = 200) { return this._req(`/transactions?limit=${limit}`); }
  async createTransaction(data) { return this._req("/transactions", { method:"POST", body: JSON.stringify(data) }); }
  async deleteTransaction(id)   { return this._req("/transactions/" + id, { method:"DELETE" }); }
  async dashboard()    { return this._req("/dashboard"); }
  async listGoals()    { return this._req("/goals"); }
  async createGoal(d)  { return this._req("/goals", { method:"POST", body: JSON.stringify(d) }); }
  async deleteGoal(id) { return this._req("/goals/" + id, { method:"DELETE" }); }
  async listRules()    { return this._req("/rules"); }
  async createRule(d)  { return this._req("/rules", { method:"POST", body: JSON.stringify(d) }); }
  async deleteRule(id) { return this._req("/rules/" + id, { method:"DELETE" }); }
  async seedDemo()     { return this._req("/demo", { method:"POST" }); }
  logout() { this.token = ""; localStorage.removeItem("fa_token"); }
}


async function pickStore(apiBase, token) {
  if (apiBase) {
    try {
      const res = await fetch(apiBase + "/", { signal: AbortSignal.timeout(1500) });
      if (res.ok) return new ApiStore(apiBase, token);
    } catch { /* backend indisponível -> cai para local */ }
  }
  return new LocalStore();
}

window.Store = { LocalStore, ApiStore, pickStore };
