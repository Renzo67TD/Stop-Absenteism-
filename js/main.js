/* ==========================================================================
   PRESENT PO!  ·  js/main.js  ·  FINAL
   Vanilla JS, additive only: every page works with JavaScript switched off.
   JS never writes style="" markup. It only (a) toggles classes and
   (b) calls element.style.setProperty on CSS custom properties.

   Contents
     1. Mobile nav + active page
     2. Scroll progress           (--progress on <html>)
     3. Arrow wrapper             (.arrow[data-dir] inside .card-link)
     4. Pointer tracking          (--px/--py on .card, --mx/--my on .img-slot,
                                   --bx on .hero/.page-banner; mouse and pen only)
     5. Scroll reveal             (.rv / .rv-in / --i, below the fold only)
     6. Hero click mark           (.hero-mark, --cx/--cy)
     7. Roll Call                 (Home)
     8. 5-Day Challenge           (Solutions)
     9. Pledge page: print + Pledge Wall
    10. Print: reveal states cleared, FAQ answers opened
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;

  // Tell the CSS that JavaScript is available (enables the mobile menu).
  root.classList.add("js");

  // ---------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------
  var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function reduced() { return !!(mqReduce && mqReduce.matches); }

  function raf(fn) {
    return (window.requestAnimationFrame || function (f) { return window.setTimeout(f, 16); })(fn);
  }

  function clamp(n, lo, hi) { return Math.min(Math.max(n, lo), hi); }

  // Live-region helper: clearing first makes a repeated message announce again.
  function announce(node, text) {
    if (!node) { return; }
    node.textContent = "";
    raf(function () { node.textContent = text; });
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    return node;
  }

  // ---------------------------------------------------------------
  // 1. Mobile hamburger toggle + active-page nav highlight
  // ---------------------------------------------------------------
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    // Desktop width has no menu button: never leave the menu in a stale "open" state.
    var mqNav = window.matchMedia ? window.matchMedia("(max-width: 1000px)") : null;
    var closeOnWide = function () {
      if (mqNav && !mqNav.matches && links.classList.contains("open")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    };
    if (mqNav) {
      if (mqNav.addEventListener) { mqNav.addEventListener("change", closeOnWide); }
      else if (mqNav.addListener) { mqNav.addListener(closeOnWide); }
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && links.classList.contains("open")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  var current = window.location.pathname.split("/").pop() || "index.html";
  var navLinks = document.querySelectorAll("#nav-links a");
  for (var i = 0; i < navLinks.length; i++) {
    if (navLinks[i].getAttribute("href") === current) {
      navLinks[i].classList.add("active");
      navLinks[i].setAttribute("aria-current", "page");
    }
  }

  // ---------------------------------------------------------------
  // 2. Scroll progress: --progress (0..1) on <html>, rAF-throttled
  // ---------------------------------------------------------------
  var progressQueued = false;
  function updateProgress() {
    progressQueued = false;
    var max = root.scrollHeight - window.innerHeight;
    var y = window.pageYOffset || root.scrollTop || 0;
    var p = max > 0 ? clamp(y / max, 0, 1) : 0;
    root.style.setProperty("--progress", p.toFixed(4));
  }
  function queueProgress() {
    if (!progressQueued) { progressQueued = true; raf(updateProgress); }
  }
  window.addEventListener("scroll", queueProgress, { passive: true });
  window.addEventListener("resize", queueProgress);
  updateProgress();

  // ---------------------------------------------------------------
  // 3. Arrow wrapper: wrap a trailing arrow glyph of .card-link in
  //    <span class="arrow" aria-hidden="true" data-dir="right|down">
  // ---------------------------------------------------------------
  var cardLinks = document.querySelectorAll(".card-link");
  for (var cl = 0; cl < cardLinks.length; cl++) {
    var link = cardLinks[cl];
    var node = link.lastChild;
    while (node && node.nodeType === 3 && !node.nodeValue.trim()) { node = node.previousSibling; }
    if (!node || node.nodeType !== 3) { continue; }
    var text = node.nodeValue;
    var found = /\s*([\u2192\u2193])\s*$/.exec(text);
    if (!found) { continue; }
    var lead = /^\s*/.exec(found[0])[0];
    node.nodeValue = text.slice(0, found.index) + lead;
    var arrow = el("span", "arrow");
    arrow.setAttribute("aria-hidden", "true");
    arrow.setAttribute("data-dir", found[1] === "\u2193" ? "down" : "right");
    arrow.textContent = found[1];
    link.insertBefore(arrow, node.nextSibling);
  }

  // ---------------------------------------------------------------
  // 4. Pointer tracking (mouse and pen only; never touch; never when
  //    the visitor prefers reduced motion). One delegated listener,
  //    rAF-throttled, writes custom properties only.
  // ---------------------------------------------------------------
  var track = { x: 0, y: 0, target: null, queued: false, card: null, slot: null, band: null };

  function clearCard(node) { if (node) { node.style.removeProperty("--px"); node.style.removeProperty("--py"); } }
  function clearSlot(node) { if (node) { node.style.removeProperty("--mx"); node.style.removeProperty("--my"); } }
  function clearBand(node) { if (node) { node.style.removeProperty("--bx"); } }
  function clearTracking() {
    clearCard(track.card); clearSlot(track.slot); clearBand(track.band);
    track.card = track.slot = track.band = null;
  }

  function applyTracking() {
    track.queued = false;
    var t = track.target;
    if (!t || !t.closest || reduced()) { clearTracking(); return; }

    var card = t.closest(".card");
    var slot = t.closest(".img-slot");
    var band = t.closest(".hero, .page-banner");

    if (track.card && track.card !== card) { clearCard(track.card); }
    if (track.slot && track.slot !== slot) { clearSlot(track.slot); }
    if (track.band && track.band !== band) { clearBand(track.band); }
    track.card = card; track.slot = slot; track.band = band;

    var r;
    if (card) {
      r = card.getBoundingClientRect();
      card.style.setProperty("--px", (track.x - r.left).toFixed(1) + "px");
      card.style.setProperty("--py", (track.y - r.top).toFixed(1) + "px");
    }
    if (slot) {
      r = slot.getBoundingClientRect();
      if (r.width && r.height) {
        slot.style.setProperty("--mx", clamp(((track.x - r.left) / r.width) * 2 - 1, -1, 1).toFixed(3));
        slot.style.setProperty("--my", clamp(((track.y - r.top) / r.height) * 2 - 1, -1, 1).toFixed(3));
      }
    }
    if (band) {
      r = band.getBoundingClientRect();
      if (r.width) {
        band.style.setProperty("--bx", clamp(((track.x - r.left) / r.width) * 2 - 1, -1, 1).toFixed(3));
      }
    }
  }

  document.addEventListener("pointermove", function (event) {
    var ok = (event.pointerType === "mouse" || event.pointerType === "pen") && !reduced();
    if (!ok) {
      if (track.card || track.slot || track.band) { clearTracking(); }
      return;
    }
    track.x = event.clientX;
    track.y = event.clientY;
    track.target = event.target;
    if (!track.queued) { track.queued = true; raf(applyTracking); }
  }, { passive: true });

  root.addEventListener("mouseleave", clearTracking);
  window.addEventListener("blur", clearTracking);

  var onMotionChange = function () { if (reduced()) { clearTracking(); } };
  if (mqReduce) {
    if (mqReduce.addEventListener) { mqReduce.addEventListener("change", onMotionChange); }
    else if (mqReduce.addListener) { mqReduce.addListener(onMotionChange); }
  }

  // ---------------------------------------------------------------
  // 5. Scroll reveal. Only elements that start BELOW the fold get
  //    .rv (hidden); the observer adds .rv-in; a timer then removes
  //    both classes so no element can ever stay stuck hidden and
  //    normal hover transitions return. Skipped for reduced motion.
  // ---------------------------------------------------------------
  function initReveal() {
    if (reduced() || !("IntersectionObserver" in window)) { return; }

    // .gallery-grid is revealed as one piece; its frames are not armed separately
    // (otherwise the ink strip would show up empty before its frames fade in).
    var SELECTOR = ".section-head, .card, .callout, .pledge-card, .img-slot, .gallery-grid, .wall-board, .faq";
    var vh = window.innerHeight || root.clientHeight || 800;
    var all = document.querySelectorAll(SELECTOR);
    var parents = [];
    var counts = [];
    var armed = [];
    var pending = 0;

    function settle(node, delay) {
      window.setTimeout(function () {
        node.classList.remove("rv", "rv-in");
        node.style.removeProperty("--i");
        node.removeAttribute("data-rv");
      }, 260 + delay * 70 + 160);
    }

    var io = new IntersectionObserver(function (entries) {
      for (var e = 0; e < entries.length; e++) {
        var entry = entries[e];
        var target = entry.target;
        // Reveal what is in view, and anything that is already ABOVE the viewport
        // (e.g. after an anchor jump) so nothing is ever left invisible behind the reader.
        var above = entry.rootBounds && entry.boundingClientRect.bottom <= entry.rootBounds.top;
        if (!entry.isIntersecting && !above) { continue; }
        io.unobserve(target);
        pending--;
        var idx = parseInt(target.getAttribute("data-rv") || "0", 10) || 0;
        if (above) {
          target.classList.remove("rv", "rv-in");
          target.style.removeProperty("--i");
          target.removeAttribute("data-rv");
        } else {
          target.classList.add("rv-in");
          settle(target, idx);
        }
      }
      if (pending <= 0) { io.disconnect(); }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });

    function clearAll() {
      for (var n = 0; n < armed.length; n++) {
        armed[n].classList.remove("rv", "rv-in");
        armed[n].style.removeProperty("--i");
        armed[n].removeAttribute("data-rv");
      }
      io.disconnect();
      pending = 0;
    }

    for (var a = 0; a < all.length; a++) {
      var node = all[a];
      if (node.closest(".hero, .rollcall, .map-box")) { continue; }
      if (node.closest(".gallery-grid") && !node.classList.contains("gallery-grid")) { continue; }
      if (node.getBoundingClientRect().top < vh * 0.92) { continue; }

      var p = parents.indexOf(node.parentNode);
      if (p === -1) { parents.push(node.parentNode); counts.push(0); p = parents.length - 1; }
      var order = Math.min(counts[p], 4);
      counts[p]++;

      node.classList.add("rv");
      node.style.setProperty("--i", String(order));
      node.setAttribute("data-rv", String(order));
      armed.push(node);
      pending++;
      io.observe(node);
    }
    if (!pending) { io.disconnect(); }

    // Printing, and coming back from the back/forward cache, must never find anything hidden.
    window.addEventListener("beforeprint", clearAll);
    window.addEventListener("pageshow", function (event) { if (event.persisted) { clearAll(); } });
  }
  initReveal();

  // ---------------------------------------------------------------
  // 6. Hero: click anywhere to drop a tick, then a stamp, alternating.
  //    aria-hidden, one-shot, removed after it fades. Off when the
  //    visitor prefers reduced motion (the CSS hides it as well).
  // ---------------------------------------------------------------
  var hero = document.querySelector(".hero");
  if (hero) {
    var stampNext = false;
    hero.addEventListener("click", function (event) {
      if (reduced() || event.detail === 0) { return; }
      if (event.target.closest && event.target.closest("a, button, input, textarea, select, label, summary")) { return; }

      var old = hero.querySelectorAll(".hero-mark");
      while (old.length > 9) { old[0].parentNode.removeChild(old[0]); old = hero.querySelectorAll(".hero-mark"); }

      var rect = hero.getBoundingClientRect();
      var mark = el("span", "hero-mark" + (stampNext ? " is-stamp" : ""));
      stampNext = !stampNext;
      mark.setAttribute("aria-hidden", "true");
      mark.style.setProperty("--cx", (event.clientX - rect.left).toFixed(1));
      mark.style.setProperty("--cy", (event.clientY - rect.top).toFixed(1));
      hero.appendChild(mark);

      var gone = function () { if (mark.parentNode) { mark.parentNode.removeChild(mark); } };
      mark.addEventListener("animationend", function (ev) { if (ev.animationName === "fadeOut") { gone(); } });
      window.setTimeout(gone, 2400);
    });
  }

  // ---------------------------------------------------------------
  // 7. Roll call (Home page). Names stay on screen only: nothing is
  //    saved or sent anywhere. The section is hidden until JS runs.
  // ---------------------------------------------------------------
  var rollcall = document.querySelector(".rollcall");
  if (rollcall) {
    rollcall.removeAttribute("hidden");

    var form = rollcall.querySelector(".rollcall-form");
    var input = rollcall.querySelector("#rollcall-name");
    var list = rollcall.querySelector(".rollcall-list");
    var msg = rollcall.querySelector(".rollcall-msg");
    var MAX_ROWS = 6;

    var today = "";
    try {
      today = new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    } catch (e) {
      today = "";
    }

    if (form && input && list) {
      input.addEventListener("input", function () { if (msg && msg.textContent) { msg.textContent = ""; } });
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var name = input.value.replace(/\s+/g, " ").trim();
        if (!name) {
          announce(msg, "Type your first name, then press Present Po!");
          input.focus();
          return;
        }

        var row = document.createElement("li");

        var nameEl = document.createElement("span");
        nameEl.className = "rc-name";
        nameEl.textContent = name;
        row.appendChild(nameEl);

        if (today) {
          var dateEl = document.createElement("span");
          dateEl.className = "rc-date";
          dateEl.textContent = today;
          row.appendChild(dateEl);
        }

        var stamp = document.createElement("span");
        stamp.className = "rc-stamp is-new";
        stamp.textContent = "Present Po! \u2713";
        stamp.addEventListener("animationend", function () { stamp.classList.remove("is-new"); });
        row.appendChild(stamp);

        list.appendChild(row);
        while (list.children.length > MAX_ROWS) {
          list.removeChild(list.firstElementChild);
        }

        announce(msg, name + ", you are marked present. Present Po!");
        input.value = "";
        input.focus();
      });
    }
  }

  // ---------------------------------------------------------------
  // 8. 5-Day Attendance Challenge tracker (Solutions page).
  //    Ticks are kept in this browser only. No names, nothing sent.
  // ---------------------------------------------------------------
  var challenge = document.getElementById("challenge");
  if (challenge) {
    var grid = challenge.querySelector(".grid");
    var cards = challenge.querySelectorAll(".grid .card");
    var KEY = "presentpo-challenge";
    var saved = [];

    try {
      saved = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    } catch (e) {
      saved = [];
    }
    if (Object.prototype.toString.call(saved) !== "[object Array]") { saved = []; }

    var note = document.createElement("p");
    note.className = "challenge-note";
    note.setAttribute("role", "status");
    if (grid && grid.parentNode) {
      grid.parentNode.insertBefore(note, grid.nextSibling);
    }

    var done = [];

    var refresh = function () {
      var count = 0;
      for (var n = 0; n < cards.length; n++) {
        if (done[n]) { count++; }
      }
      if (cards.length && count === cards.length) {
        note.textContent = "All days ticked! You said Present Po! every day of the challenge.";
      } else {
        note.textContent = "Press Tick it on each day you finish. Your ticks stay on this device only.";
      }
    };

    var save = function () {
      var out = [];
      for (var n = 0; n < done.length; n++) {
        if (done[n]) { out.push(n); }
      }
      try {
        window.localStorage.setItem(KEY, JSON.stringify(out));
      } catch (e) { /* storage unavailable: ticks just last for this visit */ }
    };

    var build = function (card, index) {
      var title = card.querySelector("h3");
      var row = document.createElement("div");
      row.className = "tick-row";

      var button = document.createElement("button");
      button.type = "button";
      button.className = "tick";
      button.textContent = "Tick it";
      button.id = "tick-btn-" + index;
      if (title) {
        title.id = title.id || "tick-title-" + index;
        button.setAttribute("aria-labelledby", button.id + " " + title.id);
      }

      var stampEl = document.createElement("span");
      stampEl.className = "tick-stamp";
      stampEl.textContent = "Present \u2713";
      stampEl.setAttribute("aria-hidden", "true");

      var apply = function () {
        button.setAttribute("aria-pressed", done[index] ? "true" : "false");
        if (done[index]) {
          card.classList.add("is-done");
        } else {
          card.classList.remove("is-done");
        }
      };

      button.addEventListener("click", function () {
        done[index] = !done[index];
        apply();
        save();
        refresh();
        if (done[index]) {
          // one stamp slam (the CSS only animates it when motion is allowed)
          card.classList.remove("is-slam");
          void card.offsetWidth;
          card.classList.add("is-slam");
          window.setTimeout(function () { card.classList.remove("is-slam"); }, 420);
        }
      });

      row.appendChild(button);
      row.appendChild(stampEl);
      card.appendChild(row);
      apply();
    };

    for (var c = 0; c < cards.length; c++) {
      done[c] = false;
    }
    for (var s = 0; s < saved.length; s++) {
      if (typeof saved[s] === "number" && saved[s] >= 0 && saved[s] < cards.length) {
        done[saved[s]] = true;
      }
    }
    for (var b = 0; b < cards.length; b++) {
      build(cards[b], b);
    }
    refresh();
  }

  // ---------------------------------------------------------------
  // 9a. Pledge page: print button
  // ---------------------------------------------------------------
  var printButtons = document.querySelectorAll("[data-print]");
  for (var pb = 0; pb < printButtons.length; pb++) {
    printButtons[pb].removeAttribute("hidden");
    printButtons[pb].addEventListener("click", function () { window.print(); });
  }

  // ---------------------------------------------------------------
  // 9b. Pledge Wall: pin a note on the board and/or open a ready-to-send
  //     email. Pinned notes live on this screen only. Nothing is stored
  //     or sent by the page itself.
  // ---------------------------------------------------------------
  var pinForm = document.getElementById("pin-form");
  var wallNotes = document.getElementById("wall-notes");
  if (pinForm && wallNotes) {
    var pinOnly = document.getElementById("pin-only");
    var pinMsg = document.querySelector(".pin-msg");
    var MAX_USER_NOTES = 8;

    if (pinOnly) { pinOnly.removeAttribute("hidden"); }

    var say = function (text) { announce(pinMsg, text); };
    var clean = function (value) { return (value || "").replace(/\s+/g, " ").trim(); };

    var readForm = function () {
      return {
        name: clean(document.getElementById("pin-name").value),
        klass: clean(document.getElementById("pin-class").value),
        adviser: clean(document.getElementById("pin-adviser").value),
        promise: clean(document.getElementById("pin-promise").value)
      };
    };

    var pinNote = function (v) {
      var noteEl = document.createElement("li");
      noteEl.className = "wall-note is-user is-new";
      noteEl.addEventListener("animationend", function () { noteEl.classList.remove("is-new"); });

      var textEl = document.createElement("p");
      textEl.className = "wall-text";
      textEl.textContent = v.promise;
      noteEl.appendChild(textEl);

      var by = document.createElement("p");
      by.className = "wall-by";
      by.textContent = v.name + ", " + v.klass;
      noteEl.appendChild(by);

      wallNotes.insertBefore(noteEl, wallNotes.firstChild);

      var mine = wallNotes.querySelectorAll(".wall-note.is-user");
      if (mine.length > MAX_USER_NOTES) {
        wallNotes.removeChild(mine[mine.length - 1]);
      }
    };

    var buildMailto = function (v) {
      var to = (pinForm.getAttribute("action") || "").replace(/^mailto:/i, "");
      if (!to || to.indexOf("[[") !== -1) { return ""; }
      var subject = "Present Po! pledge: " + v.name + ", " + v.klass;
      var lines = [
        "Present Po! pledge",
        "",
        "First name: " + v.name,
        "Grade and section: " + v.klass,
        "Class adviser: " + (v.adviser || "(not given)"),
        "My promise: " + v.promise,
        "",
        "I have read the Present Po! pledge card and I mean it."
      ];
      return "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\r\n"));
    };

    pinForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var v = readForm();
      if (!v.name || !v.klass) { say("Please fill in your first name and your grade and section."); return; }
      pinNote(v);
      var mailLink = buildMailto(v);
      if (mailLink) {
        say("Pinned! Your email app should open with your pledge ready. Press Send to finish.");
        window.location.href = mailLink;
      } else {
        say("Pinned on your screen. Ask your class adviser how to hand in your pledge.");
      }
      pinForm.reset();
    });

    if (pinOnly) {
      pinOnly.addEventListener("click", function () {
        if (!pinForm.checkValidity()) { pinForm.reportValidity(); return; }
        var v = readForm();
        pinNote(v);
        say("Pinned! It is only on your screen. Email it or hand in a signed card to make it official.");
        pinForm.reset();
      });
    }
  }

  // ---------------------------------------------------------------
  // 10. Print: closed FAQ answers would be missing from the page, so open
  //     them for the print job and put them back afterwards.
  // ---------------------------------------------------------------
  var reopened = [];
  window.addEventListener("beforeprint", function () {
    var all = document.querySelectorAll("details:not([open])");
    for (var d = 0; d < all.length; d++) { all[d].setAttribute("open", ""); reopened.push(all[d]); }
  });
  window.addEventListener("afterprint", function () {
    while (reopened.length) { reopened.pop().removeAttribute("open"); }
  });

})();
