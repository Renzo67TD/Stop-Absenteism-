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

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
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
    if (mqNav) { mqNav.addEventListener("change", closeOnWide); }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && links.classList.contains("open")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelector('#nav-links a[href="' + current + '"]')?.setAttribute("aria-current", "page");

  // ---------------------------------------------------------------
  // 2. Scroll progress: --progress (0..1) on <html>, rAF-throttled
  // ---------------------------------------------------------------
  var progressQueued = false;
  function updateProgress() {
    progressQueued = false;
    var max = root.scrollHeight - window.innerHeight;
    var y = window.scrollY;
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
  const cardLinks = document.querySelectorAll(".card-link");
  for (const link of cardLinks) {
    let node = link.lastChild;
    while (node && node.nodeType === 3 && !node.nodeValue.trim()) { node = node.previousSibling; }
    if (!node || node.nodeType !== 3) { continue; }
    const text = node.nodeValue;
    const found = /\s*([\u2192\u2193])\s*$/.exec(text);
    if (!found) { continue; }
    const lead = /^\s*/.exec(found[0])[0];
    node.nodeValue = text.slice(0, found.index) + lead;
    const arrow = el("span", "arrow");
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
  var track = { x: 0, y: 0, target: null, queued: false };

  // One entry per tracked element. sel: what closest() looks for; props: the custom
  // properties it writes; node: the element currently carrying them; set(node, r):
  // writes them from the pointer position and the element's rect.
  // A fourth tracked element is one more entry here.
  var trackers = [
    {
      sel: ".card",
      props: ["--px", "--py"],
      node: null,
      set: function (node, r) {
        node.style.setProperty("--px", (track.x - r.left).toFixed(1) + "px");
        node.style.setProperty("--py", (track.y - r.top).toFixed(1) + "px");
      }
    },
    {
      sel: ".img-slot",
      props: ["--mx", "--my"],
      node: null,
      set: function (node, r) {
        if (r.width && r.height) {
          node.style.setProperty("--mx", clamp(((track.x - r.left) / r.width) * 2 - 1, -1, 1).toFixed(3));
          node.style.setProperty("--my", clamp(((track.y - r.top) / r.height) * 2 - 1, -1, 1).toFixed(3));
        }
      }
    },
    {
      sel: ".hero, .page-banner",
      props: ["--bx"],
      node: null,
      set: function (node, r) {
        if (r.width) {
          node.style.setProperty("--bx", clamp(((track.x - r.left) / r.width) * 2 - 1, -1, 1).toFixed(3));
        }
      }
    }
  ];

  function clearTracker(tr) {
    if (!tr.node) { return; }
    tr.props.forEach(function (prop) { tr.node.style.removeProperty(prop); });
  }
  function clearTracking() {
    trackers.forEach(function (tr) { clearTracker(tr); tr.node = null; });
  }

  function applyTracking() {
    track.queued = false;
    var t = track.target;
    if (!t || !t.closest || reduced()) { clearTracking(); return; }

    var found = trackers.map(function (tr) { return t.closest(tr.sel); });

    // clear whatever the pointer has left, then remember what it is over now
    trackers.forEach(function (tr, k) {
      if (tr.node && tr.node !== found[k]) { clearTracker(tr); }
      tr.node = found[k];
    });
    trackers.forEach(function (tr) {
      if (tr.node) { tr.set(tr.node, tr.node.getBoundingClientRect()); }
    });
  }

  document.addEventListener("pointermove", function (event) {
    var ok = (event.pointerType === "mouse" || event.pointerType === "pen") && !reduced();
    if (!ok) {
      if (trackers.some(function (tr) { return tr.node; })) { clearTracking(); }
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
  if (mqReduce) { mqReduce.addEventListener("change", onMotionChange); }

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
    const seen = new Map();   // parent node -> how many of its children are armed so far
    var armed = [];
    var pending = 0;

    // Safety net only, not tied to the CSS timings: if transitionend never fires
    // (reduced motion switched on mid-visit, element not rendered), the classes
    // are still cleaned up. Keep it longer than the slowest reveal in the CSS.
    var SETTLE_FALLBACK_MS = 1500;

    function settle(node) {
      var timer = 0;

      function finish() {
        window.clearTimeout(timer);
        node.removeEventListener("transitionend", onEnd);
        node.classList.remove("rv", "rv-in");
        node.style.removeProperty("--i");
        node.removeAttribute("data-rv");
      }

      // transitionend bubbles, so ignore ones that come from child elements.
      function onEnd(event) {
        if (event.target === node) { finish(); }
      }

      if (reduced()) { finish(); return; }
      node.addEventListener("transitionend", onEnd);
      timer = window.setTimeout(finish, SETTLE_FALLBACK_MS);
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
        if (above) {
          target.classList.remove("rv", "rv-in");
          target.style.removeProperty("--i");
          target.removeAttribute("data-rv");
        } else {
          target.classList.add("rv-in");
          settle(target);
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

    for (const node of all) {
      if (node.closest(".hero, .rollcall, .map-box")) { continue; }
      if (node.closest(".gallery-grid") && !node.classList.contains("gallery-grid")) { continue; }
      if (node.getBoundingClientRect().top < vh * 0.92) { continue; }

      const index = seen.get(node.parentNode) ?? 0;
      seen.set(node.parentNode, index + 1);
      const order = Math.min(index, 4);

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
    var count = 0;

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

        var row = el("li");
        row.dataset.no = String(++count).padStart(2, "0");   // "01", "02"... CSS shows it as "No. 01"
        row.append(el("span", "rc-name", name));

        if (today) {
          row.append(el("span", "rc-date", today));
        }

        var stamp = el("span", "rc-stamp is-new", "Present Po! \u2713");
        stamp.addEventListener("animationend", function () { stamp.classList.remove("is-new"); });
        row.append(stamp);

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

    // Indexes of the ticked days. Anything in storage that is not a valid day index is ignored.
    var done = new Set(saved.filter(function (n) {
      return Number.isInteger(n) && n >= 0 && n < cards.length;
    }));

    var refresh = function () {
      if (cards.length && done.size === cards.length) {
        note.textContent = "All days ticked! You said Present Po! every day of the challenge.";
      } else {
        note.textContent = "Press Tick it on each day you finish. Your ticks stay on this device only.";
      }
    };

    var save = function () {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(Array.from(done)));
      } catch (e) { /* storage unavailable: ticks just last for this visit */ }
    };

    var build = function (card, index) {
      var title = card.querySelector("h3");
      var row = el("div", "tick-row");

      var button = el("button", "tick", "Tick it");
      button.type = "button";
      button.id = "tick-btn-" + index;
      if (title) {
        title.id = title.id || "tick-title-" + index;
        button.setAttribute("aria-labelledby", button.id + " " + title.id);
      }

      var stampEl = el("span", "tick-stamp", "Present \u2713");
      stampEl.setAttribute("aria-hidden", "true");

      var apply = function () {
        button.setAttribute("aria-pressed", done.has(index) ? "true" : "false");
        if (done.has(index)) {
          card.classList.add("is-done");
        } else {
          card.classList.remove("is-done");
        }
      };

      button.addEventListener("click", function () {
        if (done.has(index)) { done.delete(index); } else { done.add(index); }
        apply();
        save();
        refresh();
        if (done.has(index)) {
          // one stamp slam (the CSS only animates it when motion is allowed)
          card.classList.remove("is-slam");
          void card.offsetWidth;
          card.classList.add("is-slam");
          window.setTimeout(function () { card.classList.remove("is-slam"); }, 420);
        }
      });

      row.append(button, stampEl);
      card.appendChild(row);
      apply();
    };

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
  // 9b. Pledge Wall: pin a note on the board, open a ready-to-send email
  //     and/or copy the pledge text. Pinned notes live on this screen only.
  //     Nothing is stored or sent by the page itself.
  // ---------------------------------------------------------------
  var pinForm = document.getElementById("pin-form");
  var wallNotes = document.getElementById("wall-notes");
  if (pinForm && wallNotes) {
    var pinOnly = document.getElementById("pin-only");
    var pinCopy = document.getElementById("pin-copy");
    var pinMsg = document.querySelector(".pin-msg");
    var MAX_USER_NOTES = 8;
    var PIN_FAILED = "Sorry, your note could not be pinned. Your answers are still here, so please try again.";

    if (pinOnly) { pinOnly.removeAttribute("hidden"); }
    if (pinCopy) { pinCopy.removeAttribute("hidden"); }

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
      var noteEl = el("li", "wall-note is-user is-new");
      noteEl.addEventListener("animationend", function () { noteEl.classList.remove("is-new"); });

      noteEl.append(
        el("p", "wall-text", v.promise),
        el("p", "wall-by", v.name + ", " + v.klass)
      );

      wallNotes.insertBefore(noteEl, wallNotes.firstChild);

      var mine = wallNotes.querySelectorAll(".wall-note.is-user");
      if (mine.length > MAX_USER_NOTES) {
        wallNotes.removeChild(mine[mine.length - 1]);
      }
    };

    // Pins the note once. Returns false if pinning failed, so the form is kept.
    // If this exact pledge is already on the wall, it is not pinned a second time.
    var pinnedKey = "";
    var pin = function (v) {
      var key = [v.name, v.klass, v.promise].join("|");
      if (key === pinnedKey) { return true; }
      try {
        pinNote(v);
      } catch (e) {
        return false;
      }
      pinnedKey = key;
      return true;
    };

    // The school address from the form's action ("" if it is missing or still a placeholder).
    var mailAddress = function () {
      var to = (pinForm.getAttribute("action") || "").replace(/^mailto:/i, "");
      return (!to || to.indexOf("[[") !== -1) ? "" : to;
    };

    var pledgeLines = function (v) {
      return [
        "Present Po! pledge",
        "",
        "First name: " + v.name,
        "Grade and section: " + v.klass,
        "Class adviser: " + (v.adviser || "(not given)"),
        "My promise: " + v.promise,
        "",
        "I have read the Present Po! pledge card and I mean it."
      ];
    };

    var buildMailto = function (v) {
      var to = mailAddress();
      if (!to) { return ""; }
      var subject = "Present Po! pledge: " + v.name + ", " + v.klass;
      return "mailto:" + to + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(pledgeLines(v).join("\r\n"));
    };

    pinForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var v = readForm();
      if (!v.name || !v.klass) { say("Please fill in your first name and your grade and section."); return; }
      if (!pin(v)) { say(PIN_FAILED); return; }
      var mailLink = buildMailto(v);
      if (mailLink) {
        say("Pinned! Your email app should open with your pledge ready. Press Send to finish. If nothing opens, press Copy my pledge and paste it into an email to " + mailAddress() + ".");
        window.location.href = mailLink;
      } else {
        say("Pinned on your screen. Press Copy my pledge, or ask your class adviser how to hand in your pledge.");
      }
      // The form is left filled in on purpose: if no email app opens,
      // "Copy my pledge" still has the answers to copy.
    });

    if (pinOnly) {
      pinOnly.addEventListener("click", function () {
        if (!pinForm.checkValidity()) { pinForm.reportValidity(); return; }
        var v = readForm();
        if (!pin(v)) { say(PIN_FAILED); return; }
        say("Pinned! It is only on your screen. Email it or hand in a signed card to make it official.");
        pinForm.reset();
        pinnedKey = "";
      });
    }

    if (pinCopy) {
      pinCopy.addEventListener("click", function () {
        if (!pinForm.checkValidity()) { pinForm.reportValidity(); return; }
        var v = readForm();
        var text = pledgeLines(v).join("\n");
        var noCopy = function () {
          say("Copying does not work here. Write your pledge in an email yourself, or print the pledge card and hand it to your class adviser.");
        };
        // The Clipboard API only exists on https:// or localhost, not on file://.
        if (!navigator.clipboard || !navigator.clipboard.writeText) { noCopy(); return; }
        navigator.clipboard.writeText(text).then(function () {
          var to = mailAddress();
          say("Copied! Paste it into an email" + (to ? " to " + to : "") + ", or hand it to your class adviser.");
        }, noCopy);
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
