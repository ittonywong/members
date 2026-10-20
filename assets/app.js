/* 會員網站主程式 — Members site logic (Supabase Auth, supabase-js v2 UMD) */
(function () {
  "use strict";
  var C = window.MEMBERS_CONFIG || {};
  var L = window.I18N || {};
  var LANGS = ["zh-Hant", "zh-Hans", "en", "ja", "mi", "ko"];
  var KEY_LANG = "members.lang", KEY_FS = "members.fs";
  var MINPW = Math.max(6, parseInt(C.MIN_PASSWORD_LENGTH, 10) || 8);
  var page = document.body.getAttribute("data-page");
  var lang = store(KEY_LANG);
  if (LANGS.indexOf(lang) < 0) lang = "en";
  var sb = null;

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function $(id) { return document.getElementById(id); }
  function qsa(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function t(k, vars) {
    var s = (L[lang] && L[lang][k]) || (L.en && L.en[k]) || (L["zh-Hant"] && L["zh-Hant"][k]) || k;
    vars = vars || {};
    if (vars.n === undefined) vars.n = MINPW;
    for (var v in vars) s = s.split("{" + v + "}").join(vars[v]);
    return s;
  }
  function abs(file) { return new URL(file, location.href).href.split("#")[0].split("?")[0]; }

  /* ---------- i18n + font size ---------- */
  var LCODE = {"zh-Hant":"繁","zh-Hans":"简",en:"EN",ja:"日",mi:"Mā",ko:"한"};
  function applyI18n() {
    document.documentElement.lang = lang;
    qsa("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    qsa("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))); });
    var tk = document.body.getAttribute("data-title");
    document.title = (tk ? t(tk) + " | " : "") + t("appName");
    var sel = $("lang"); if (sel) sel.value = lang;
    var lc = $("lcodeT"); if (lc) lc.textContent = LCODE[lang] || lang;
    qsa(".msg[data-key]").forEach(renderMsg);
  }
  function setFs(n) {
    n = String(n); if (["0", "1", "2"].indexOf(n) < 0) n = "1";
    document.documentElement.className = document.documentElement.className.replace(/\bfs\d\b/g, "").trim() + " fs" + n;
    qsa(".fs button").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-fs") === n ? "true" : "false"); });
    store(KEY_FS, n);
  }
  function initChrome() {
    setFs(store(KEY_FS) || "1");
    var sel = $("lang");
    if (sel) sel.addEventListener("change", function () { lang = sel.value; store(KEY_LANG, lang); applyI18n(); });
    qsa(".fs button").forEach(function (b) { b.addEventListener("click", function () { setFs(b.getAttribute("data-fs")); }); });
    qsa("input[data-showpw]").forEach(function (c) {
      c.addEventListener("change", function () {
        qsa("input.pw").forEach(function (i) { i.type = c.checked ? "text" : "password"; });
      });
    });
    applyI18n();
  }

  /* ---------- messages ---------- */
  function renderMsg(el) {
    var vars = {}; try { vars = JSON.parse(el.getAttribute("data-vars") || "{}"); } catch (e) {}
    el.textContent = t(el.getAttribute("data-key"), vars);
  }
  function msg(id, key, type, vars) {
    var el = $(id || "msg"); if (!el) return;
    if (!key) { el.hidden = true; el.removeAttribute("data-key"); return; }
    el.className = "msg " + (type || "info");
    el.setAttribute("role", type === "err" ? "alert" : "status");
    el.setAttribute("data-key", key);
    el.setAttribute("data-vars", JSON.stringify(vars || {}));
    renderMsg(el); el.hidden = false;
  }

  /* ---------- error mapping ---------- */
  function errKey(err) {
    if (!err) return null;
    var code = String(err.code || err.error_code || "").toLowerCase();
    var m = String(err.message || err.error_description || err.msg || "").toLowerCase();
    var st = err.status;
    if (code === "invalid_credentials" || m.indexOf("invalid login credentials") >= 0) return "eInvalid";
    if (code === "email_not_confirmed" || m.indexOf("email not confirmed") >= 0) return "eNotConfirmed";
    if (code === "user_already_exists" || code === "email_exists" || m.indexOf("already registered") >= 0) return "eExists";
    if (code === "same_password" || m.indexOf("different from the old") >= 0) return "eSame";
    if (code === "weak_password" || m.indexOf("password should") >= 0 || m.indexOf("weak") >= 0) return "eWeak";
    if (code === "email_address_not_authorized" || m.indexOf("not authorized") >= 0) return "eNotAuth";
    if (code === "email_address_invalid" || code === "validation_failed" || m.indexOf("invalid format") >= 0 || (m.indexOf("email address") >= 0 && m.indexOf("invalid") >= 0)) return "eEmail";
    if (code === "signup_disabled" || code === "email_provider_disabled" || m.indexOf("signups not allowed") >= 0) return "eSignupDisabled";
    if (code === "otp_expired" || code === "flow_state_expired" || m.indexOf("expired") >= 0) return "eLinkExpired";
    if (st === 429 || code.indexOf("rate_limit") >= 0 || m.indexOf("rate limit") >= 0 || m.indexOf("security purposes") >= 0) return "eRate";
    if (err.name === "AuthRetryableFetchError" || st === 0 || err instanceof TypeError || m.indexOf("failed to fetch") >= 0 || m.indexOf("network") >= 0 || m.indexOf("load failed") >= 0) return "eNetwork";
    return "eGeneric";
  }
  function showErr(err, id) {
    var k = errKey(err);
    msg(id, k, "err", { code: (err && (err.code || err.status || err.name)) || "?" });
    return k;
  }

  /* ---------- config + client ---------- */
  function keyIsSecret(k) {
    if (/^sb_secret_/i.test(k)) return true;
    var p = k.split(".");
    if (p.length === 3) {
      try {
        var j = JSON.parse(atob(p[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (j && j.role && j.role !== "anon") return true;
      } catch (e) {}
    }
    return false;
  }
  function configState() {
    var u = String(C.SUPABASE_URL || "").trim(), k = String(C.SUPABASE_ANON_KEY || "").trim();
    if (!/^https:\/\/[^\s/]+/i.test(u) || /YOUR[-_]/i.test(u) || k.length < 20 || /YOUR[-_]/i.test(k)) return "none";
    if (keyIsSecret(k)) return "secret";
    return "ok";
  }
  function makeClient() {
    var s = configState();
    if (s === "none") return { err: "eNotConfigured" };
    if (s === "secret") return { err: "eSecretKey" };
    if (!window.supabase || typeof window.supabase.createClient !== "function") return { err: "eLib" };
    try {
      return { client: window.supabase.createClient(String(C.SUPABASE_URL).trim().replace(/\/+$/, ""), String(C.SUPABASE_ANON_KEY).trim(), {
        auth: { flowType: "implicit", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "members-auth" }
      }) };
    } catch (e) { return { err: "eLib" }; }
  }
  function disableForms() {
    qsa("form input, form button").forEach(function (el) { el.disabled = true; });
  }

  /* Read Supabase redirect parameters (in #hash or ?query) before the library clears them */
  function urlParams() {
    var out = {};
    [location.search.replace(/^\?/, ""), location.hash.replace(/^#/, "")].forEach(function (s) {
      s.split("&").forEach(function (p) {
        if (!p) return; var i = p.indexOf("=");
        var k = decodeURIComponent(i < 0 ? p : p.slice(0, i)), v = i < 0 ? "" : decodeURIComponent(p.slice(i + 1).replace(/\+/g, " "));
        out[k] = v;
      });
    });
    return out;
  }
  var P = urlParams();
  function cleanUrl() { try { history.replaceState(null, "", location.pathname); } catch (e) {} }

  function busy(btn, on) {
    if (!btn) return;
    if (on) { btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.setAttribute("data-label", btn.getAttribute("data-i18n")); btn.setAttribute("data-i18n", "working"); }
    else { btn.disabled = false; btn.removeAttribute("aria-busy"); btn.setAttribute("data-i18n", btn.getAttribute("data-label") || btn.getAttribute("data-i18n")); }
    btn.textContent = t(btn.getAttribute("data-i18n"));
  }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function mark(id, bad) { var el = $(id); if (el) el.setAttribute("aria-invalid", bad ? "true" : "false"); }

  /* ---------- pages ---------- */
  var pages = {};

  pages.home = function () {
    if (P.error || P.error_code) { location.replace("login.html?e=" + (P.error_code === "otp_expired" ? "link_expired" : "link_error")); return; }
    var justVerified = P.type === "signup" || P.type === "email" || P.type === "invite";
    var r = makeClient();
    if (r.err) { location.replace("login.html"); return; }
    sb = r.client;
    sb.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_OUT") location.replace("login.html?e=logged_out"); });
    sb.auth.getSession().then(function (res) {
      var s = res && res.data && res.data.session;
      if (!s || !s.user) { location.replace("login.html"); return; }
      if (justVerified) msg("msg", "verifiedOk", "ok");
      cleanUrl();
      $("memberEmail").textContent = s.user.email || "";
      $("checking").hidden = true;
      $("guarded").hidden = false;
    }, function () { location.replace("login.html"); });
    $("logout").addEventListener("click", function () {
      var b = $("logout"); busy(b, true);
      sb.auth.signOut().then(function () { location.replace("login.html?e=logged_out"); }, function () { location.replace("login.html?e=logged_out"); });
    });
  };

  function resendSignup(email) {
    return sb.auth.resend({ type: "signup", email: email, options: { emailRedirectTo: abs("index.html") } });
  }

  pages.login = function () {
    if (P.e === "logged_out") msg("msg", "loggedOut", "ok");
    else if (P.e === "link_expired") msg("msg", "eLinkExpired", "err");
    else if (P.e === "link_error") msg("msg", "eGeneric", "err", { code: P.error_code || "link" });
    if (P.e) cleanUrl();
    var r = makeClient();
    if (r.err) { msg("msg", r.err, "err"); disableForms(); return; }
    sb = r.client;
    sb.auth.getSession().then(function (res) { if (res && res.data && res.data.session) location.replace("index.html"); });
    var f = $("f"), btn = $("submit"), rs = $("resend"), lastEmail = "";
    f.addEventListener("submit", function (ev) {
      ev.preventDefault(); rs.hidden = true;
      var email = $("email").value.trim(), pw = $("pw").value;
      mark("email", !validEmail(email)); mark("pw", !pw);
      if (!email || !pw) return msg("msg", "eRequired", "err");
      if (!validEmail(email)) return msg("msg", "eEmail", "err");
      busy(btn, true); msg("msg", null);
      sb.auth.signInWithPassword({ email: email, password: pw }).then(function (res) {
        busy(btn, false);
        if (res.error) { var k = showErr(res.error); if (k === "eNotConfirmed") { lastEmail = email; rs.hidden = false; } return; }
        location.replace("index.html");
      }, function (e) { busy(btn, false); showErr(e); });
    });
    rs.addEventListener("click", function () {
      busy(rs, true);
      resendSignup(lastEmail).then(function (res) { busy(rs, false); if (res.error) showErr(res.error); else { msg("msg", "resent", "ok"); rs.hidden = true; } },
        function (e) { busy(rs, false); showErr(e); });
    });
  };

  pages.signup = function () {
    var r = makeClient();
    if (r.err) { msg("msg", r.err, "err"); disableForms(); return; }
    sb = r.client;
    var f = $("f"), btn = $("submit"), email = "";
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      email = $("email").value.trim();
      var pw = $("pw").value, pw2 = $("pw2").value;
      mark("email", !validEmail(email)); mark("pw", pw.length < MINPW); mark("pw2", pw !== pw2);
      if (!email || !pw || !pw2) return msg("msg", "eRequired", "err");
      if (!validEmail(email)) return msg("msg", "eEmail", "err");
      if (pw.length < MINPW) return msg("msg", "eShort", "err");
      if (pw !== pw2) return msg("msg", "eMismatch", "err");
      if (!$("agree").checked) return msg("msg", "eAgree", "err");
      busy(btn, true); msg("msg", null);
      sb.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: abs("index.html") } }).then(function (res) {
        busy(btn, false);
        if (res.error) return showErr(res.error);
        var d = res.data || {};
        if (d.session) { location.replace("index.html"); return; }
        f.hidden = true; $("done").hidden = false;
        msg("checkMsg", d.user && d.user.identities && d.user.identities.length === 0 ? "eMaybeExists" : "checkBody", "ok", { email: email });
      }, function (e) { busy(btn, false); showErr(e); });
    });
    $("resend").addEventListener("click", function () {
      var b = $("resend"); busy(b, true);
      resendSignup(email).then(function (res) { busy(b, false); if (res.error) showErr(res.error, "msg2"); else msg("msg2", "resent", "ok"); },
        function (e) { busy(b, false); showErr(e, "msg2"); });
    });
  };

  pages.forgot = function () {
    var r = makeClient();
    if (r.err) { msg("msg", r.err, "err"); disableForms(); return; }
    sb = r.client;
    var f = $("f"), btn = $("submit");
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = $("email").value.trim();
      mark("email", !validEmail(email));
      if (!email) return msg("msg", "eRequired", "err");
      if (!validEmail(email)) return msg("msg", "eEmail", "err");
      busy(btn, true); msg("msg", null);
      sb.auth.resetPasswordForEmail(email, { redirectTo: abs("reset.html") }).then(function (res) {
        busy(btn, false);
        if (res.error) return showErr(res.error);
        msg("msg", "forgotSent", "ok"); f.hidden = true;
      }, function (e) { busy(btn, false); showErr(e); });
    });
  };

  pages.reset = function () {
    var hadErr = P.error || P.error_code;
    var r = makeClient();
    if (r.err) { $("checking").hidden = true; msg("msg", r.err, "err"); return; }
    sb = r.client;
    function invalid(k) { $("checking").hidden = true; $("f").hidden = true; msg("msg", k || "resetInvalid", "err"); $("again").hidden = false; }
    function ready() { $("checking").hidden = true; $("f").hidden = false; $("again").hidden = true; msg("msg", null); }
    if (hadErr) { cleanUrl(); invalid(P.error_code === "otp_expired" ? "eLinkExpired" : "resetInvalid"); return; }
    var shown = false;
    sb.auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY" && !shown) { shown = true; ready(); } });
    sb.auth.getSession().then(function (res) {
      cleanUrl();
      if (res && res.data && res.data.session) { if (!shown) { shown = true; ready(); } }
      else if (!shown) invalid();
    }, function () { invalid(); });
    var f = $("f"), btn = $("submit");
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var pw = $("pw").value, pw2 = $("pw2").value;
      mark("pw", pw.length < MINPW); mark("pw2", pw !== pw2);
      if (!pw || !pw2) return msg("msg", "eRequired", "err");
      if (pw.length < MINPW) return msg("msg", "eShort", "err");
      if (pw !== pw2) return msg("msg", "eMismatch", "err");
      busy(btn, true); msg("msg", null);
      sb.auth.updateUser({ password: pw }).then(function (res) {
        busy(btn, false);
        if (res.error) return showErr(res.error);
        f.hidden = true; msg("msg", "resetDone", "ok"); $("home").hidden = false;
      }, function (e) { busy(btn, false); showErr(e); });
    });
  };

  pages.privacy = function () {
    var c = String(C.PRIVACY_CONTACT || "").trim(), el = $("contact");
    if (!el) return;
    if (!c || /YOUR[-_]/i.test(c)) { el.textContent = c || "—"; el.className = "placeholder"; }
    else { el.textContent = c; el.href = "mailto:" + c; }
  };

  initChrome();
  if (pages[page]) pages[page]();
})();
