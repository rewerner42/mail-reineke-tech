// Report-Generator (passwortgeschützt). Externes Script (CSP-konform: script-src 'self').
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var loginView = $("login"), genView = $("gen");
  var loginForm = $("loginForm"), pw = $("pw"), loginErr = $("loginErr"), loginBtn = $("loginBtn");
  var genForm = $("genForm"), domain = $("domain"), genBtn = $("genBtn"), genErr = $("genErr");
  var progress = $("progress"), barFill = $("barFill"), statusText = $("statusText");
  var done = $("done"), dl = $("dl"), again = $("again");

  function show(view) {
    loginView.hidden = view !== "login";
    genView.hidden = view !== "gen";
    if (view === "login") { try { pw.focus(); } catch (e) {} }
    else { try { domain.focus(); } catch (e) {} }
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
      body: JSON.stringify({ domain: d }),
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
        var name = m ? m[1] : "Sharp-Befund-" + d + ".pdf";
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
})();
