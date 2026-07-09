// Report-Generator (passwortgeschützt). Externes Script (CSP-konform: script-src 'self').
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var loginView = $("login"), genView = $("gen");
  var loginForm = $("loginForm"), pw = $("pw"), loginErr = $("loginErr"), loginBtn = $("loginBtn");
  var genForm = $("genForm"), domain = $("domain"), genBtn = $("genBtn"), genErr = $("genErr");
  var progress = $("progress"), barFill = $("barFill"), statusText = $("statusText");
  var done = $("done"), dl = $("dl"), again = $("again");
  var rep = $("rep"), addRepBtn = $("addRepBtn"), addRep = $("addRep");
  var arName = $("ar-name"), arRole = $("ar-role"), arOrg = $("ar-org"), arMail = $("ar-mail");
  var arTel = $("ar-tel"), arMobile = $("ar-mobile"), arAddr = $("ar-addr"), arWeb = $("ar-web");
  var arSave = $("ar-save"), arCancel = $("ar-cancel"), arErr = $("ar-err");
  var repRemoveWrap = $("repRemoveWrap"), repRemove = $("repRemove");

  function show(view) {
    loginView.hidden = view !== "login";
    genView.hidden = view !== "gen";
    if (view === "login") { try { pw.focus(); } catch (e) {} }
    else { ensureReps(); try { domain.focus(); } catch (e) {} }
  }

  // Startzustand: Auth prüfen → Login oder Generator zeigen.
  fetch("/api/report-auth", { headers: { accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (d) { show(d && d.authed ? "gen" : "login"); })
    .catch(function () { show("login"); });

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    loginErr.hidden = true;
    loginBtn.disabled = true;
    loginBtn.textContent = "Anmelden…";
    fetch("/api/report-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw.value }),
    })
      .then(function (r) {
        if (r.ok) { pw.value = ""; show("gen"); return null; }
        return r.json().catch(function () { return {}; }).then(function (d) {
          loginErr.textContent = (d && d.message) || "Anmeldung fehlgeschlagen.";
          loginErr.hidden = false;
        });
      })
      .catch(function () { loginErr.textContent = "Netzwerkfehler."; loginErr.hidden = false; })
      .then(function () { loginBtn.disabled = false; loginBtn.textContent = "Anmelden"; });
  });

  // Staged-Fortschrittsbalken während der (einzelnen) Generierungsanfrage.
  var timer = null;
  var STAGES = [
    [10, "Verbindung wird aufgebaut…"],
    [30, "DMARC, SPF, DKIM & DNSSEC werden geprüft…"],
    [60, "Website-Sicherheit wird gescannt (kann ~10 s dauern)…"],
    [88, "Report wird als PDF gerendert…"],
  ];
  function setBar(pct, label) {
    barFill.style.width = pct.toFixed(1) + "%";
    if (label != null) statusText.textContent = label;
  }
  function startProgress() {
    progress.hidden = false;
    done.hidden = true;
    genErr.hidden = true;
    var p = 2, i = 0;
    setBar(p, "Vorbereitung…");
    timer = setInterval(function () {
      var target = STAGES[Math.min(i, STAGES.length - 1)][0];
      var label = STAGES[Math.min(i, STAGES.length - 1)][1];
      p += Math.max(0.4, (target - p) * 0.08);
      if (p >= target - 0.5 && i < STAGES.length - 1) i++;
      if (p > 92) p = 92;
      setBar(p, label);
    }, 350);
  }
  function stopProgress() { if (timer) { clearInterval(timer); timer = null; } }

  genForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var d = (domain.value || "").trim();
    if (!d) return;
    genBtn.disabled = true;
    genErr.hidden = true;
    startProgress();

    fetch("/api/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: d, rep: repPayload() }),
    })
      .then(function (r) {
        if (r.status === 401) { stopProgress(); progress.hidden = true; show("login"); return null; }
        if (!r.ok) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            throw new Error((j && j.message) || "Report konnte nicht erstellt werden.");
          });
        }
        var cd = r.headers.get("Content-Disposition") || "";
        var m = cd.match(/filename="?([^"]+)"?/);
        var name = m ? m[1] : "Befund-" + d + ".pdf";
        return r.blob().then(function (blob) { return { blob: blob, name: name }; });
      })
      .then(function (res) {
        if (!res) return; // 401-Fall
        stopProgress();
        setBar(100, "Fertig.");
        var url = URL.createObjectURL(res.blob);
        dl.href = url;
        dl.download = res.name;
        done.hidden = false;
        // Auto-Download anstoßen (Fallback: der „PDF herunterladen“-Button).
        var a = document.createElement("a");
        a.href = url; a.download = res.name;
        document.body.appendChild(a); a.click(); a.remove();
      })
      .catch(function (err) {
        stopProgress();
        progress.hidden = true;
        genErr.textContent = (err && err.message) ? err.message : "Fehler bei der Erstellung.";
        genErr.hidden = false;
      })
      .then(function () { genBtn.disabled = false; });
  });

  again.addEventListener("click", function () {
    done.hidden = true;
    progress.hidden = true;
    setBar(0, "");
    domain.value = "";
    try { domain.focus(); } catch (e) {}
  });

  // ── Vertriebsmitarbeiter (swaps the report's "partner" card) ──────────────
  var REPS_KEY = "reportReps_v1";   // user-added reps (localStorage)
  var SEL_KEY = "reportRepSel_v1";  // last selected rep
  var serverReps = null;            // brand defaults (fetched once)
  var allReps = [];                 // combined [{key, custom, …contact}]
  var repsLoaded = false;

  function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function repKey(c) { return ((c.name || "") + "|" + (c.mail || "")).toLowerCase(); }
  function readCustomReps() { try { return JSON.parse(localStorage.getItem(REPS_KEY) || "[]") || []; } catch (e) { return []; } }
  function writeCustomReps(list) { try { localStorage.setItem(REPS_KEY, JSON.stringify(list)); } catch (e) {} }
  function tag(c, custom) { var o = {}; for (var k in c) o[k] = c[k]; o.key = repKey(c); o.custom = custom; return o; }

  function renderReps(selectKey) {
    var list = (serverReps || []).map(function (c) { return tag(c, false); })
      .concat(readCustomReps().map(function (c) { return tag(c, true); }));
    var seen = {}; allReps = [];
    list.forEach(function (r) { if (!seen[r.key]) { seen[r.key] = 1; allReps.push(r); } });
    var want = selectKey || localStorage.getItem(SEL_KEY) || (allReps[0] && allReps[0].key);
    if (!allReps.some(function (r) { return r.key === want; })) want = allReps[0] && allReps[0].key;
    rep.innerHTML = allReps.map(function (r) {
      var label = r.name + (r.org ? " — " + r.org : "") + (r.custom ? " (eigener)" : "");
      return '<option value="' + escHtml(r.key) + '"' + (r.key === want ? " selected" : "") + ">" + escHtml(label) + "</option>";
    }).join("");
    if (want) rep.value = want;
    onRepChange();
  }
  function currentRep() { for (var i = 0; i < allReps.length; i++) if (allReps[i].key === rep.value) return allReps[i]; return null; }
  function onRepChange() {
    var r = currentRep();
    if (r) { try { localStorage.setItem(SEL_KEY, r.key); } catch (e) {} }
    repRemoveWrap.hidden = !(r && r.custom);
  }
  function repPayload() {
    var r = currentRep();
    if (!r) return null;
    return { name: r.name, role: r.role, org: r.org, mail: r.mail, tel: r.tel, mobile: r.mobile, fax: r.fax, addr: r.addr, web: r.web, short: r.short };
  }
  function ensureReps() {
    if (repsLoaded) { renderReps(); return; }
    fetch("/api/report-reps", { headers: { accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : { reps: [] }; })
      .then(function (d) { serverReps = (d && d.reps) || []; repsLoaded = true; renderReps(); })
      .catch(function () { serverReps = []; repsLoaded = true; renderReps(); });
  }

  rep.addEventListener("change", onRepChange);
  addRepBtn.addEventListener("click", function () {
    addRep.hidden = !addRep.hidden;
    if (!addRep.hidden) { arErr.hidden = true; try { arName.focus(); } catch (e) {} }
  });
  arCancel.addEventListener("click", function () { addRep.hidden = true; });
  arSave.addEventListener("click", function () {
    arErr.hidden = true;
    function v(el) { return (el.value || "").trim(); }
    var c = { name: v(arName), role: v(arRole), org: v(arOrg), mail: v(arMail), tel: v(arTel), mobile: v(arMobile), addr: v(arAddr), web: v(arWeb), short: "" };
    if (!c.name || !c.mail) { arErr.textContent = "Name und E-Mail sind erforderlich."; arErr.hidden = false; return; }
    var k = repKey(c);
    var customs = readCustomReps().filter(function (x) { return repKey(x) !== k; });
    customs.push(c);
    writeCustomReps(customs);
    [arName, arRole, arOrg, arMail, arTel, arMobile, arAddr, arWeb].forEach(function (el) { el.value = ""; });
    addRep.hidden = true;
    renderReps(k);
  });
  repRemove.addEventListener("click", function () {
    var r = currentRep();
    if (!r || !r.custom) return;
    var customs = readCustomReps().filter(function (x) { return repKey(x) !== r.key; });
    writeCustomReps(customs);
    try { localStorage.removeItem(SEL_KEY); } catch (e) {}
    renderReps();
  });
})();
