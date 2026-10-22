/* Selected-option read-back, rhodium rule, and total.

   The sterling base lives on the form as data-base="180".
   Each choice's add-on lives on its input as data-price="40".
   Use data-price="0" for an option that is part of the base.
   Gold's data-price is the extra over sterling.
   Leave an attribute empty while that amount is still a blank.
   The total stays "No total yet" until the base and every selected
   add-on are numbers. Antique finish clears and disables rhodium.

   Gold quotes follow the sterling weight and the live spot.
   Making charge = sterling price minus the silver in that weight.
   Finished gold grams = sterling grams × (density ÷ 10.36).
   14k yellow is 13.07. 18k yellow is 15.58.
   Fine gold grams = finished gold grams × 1.20 × (karat ÷ 24).
   The 1.20 is dust and filings that will not be refined.
   Metal cost = fine gold grams × (gold spot per ounce ÷ 31.1035).
   Quote = making charge + metal cost, rounded up to the next $25.
   The add-on stored on the gold choice is the quote minus the sterling price.
   If the live price does not load, the saved prices from October 22, 2026
   are gold $4,095/oz and silver $56.40/oz. */

(function () {
  function parseAmount(value) {
    if (value == null) return null;
    var text = String(value).trim();
    if (text === "") return null;
    var amount = Number(text);
    return Number.isFinite(amount) ? amount : null;
  }

  function formatDollars(amount) {
    var cents = Math.round(amount * 100);
    var negative = cents < 0;
    var abs = Math.abs(cents);
    var dollars = Math.floor(abs / 100).toLocaleString("en-US");
    var remainder = abs % 100;
    var body = remainder === 0 ? dollars : dollars + "." + String(remainder).padStart(2, "0");
    return (negative ? "-$" : "$") + body;
  }

  function choiceName(input) {
    var choice = input.closest(".choice");
    var name = choice && choice.querySelector(".choice-name");
    return name ? name.textContent.replace(/\s+/g, " ").trim() : input.value;
  }

  function syncRhodium(form) {
    var finish = form.querySelector('input[name="finish"]:checked');
    var rhodium = form.querySelector('input[name="rhodium"]');
    if (!rhodium) return;
    var antique = Boolean(finish && finish.value === "antique");
    rhodium.disabled = antique;
    if (antique) rhodium.checked = false;
    var choice = rhodium.closest(".choice");
    if (choice) choice.classList.toggle("is-unavailable", antique);
  }

  function rhodiumText(input) {
    if (input.disabled) return "Unavailable with antique";
    return input.checked ? "Yes" : "No";
  }

  function render(setting) {
    var form = setting.querySelector(".options");
    var list = setting.querySelector(".readback-list");
    var total = setting.querySelector(".readback-total strong");
    if (!form || !list || !total) return;

    syncRhodium(form);

    var base = parseAmount(form.dataset.base);
    var incomplete = base === null;
    var adders = 0;
    var rows = document.createDocumentFragment();

    form.querySelectorAll("fieldset").forEach(function (fieldset) {
      var legend = fieldset.querySelector("legend");
      var row = document.createElement("div");
      var term = document.createElement("dt");
      var detail = document.createElement("dd");
      term.textContent = legend ? legend.textContent.trim() : "";

      var rhodium = fieldset.querySelector('input[name="rhodium"]');
      if (rhodium) {
        detail.textContent = rhodiumText(rhodium);
        if (!rhodium.disabled && rhodium.checked) {
          var rhodiumPrice = parseAmount(rhodium.dataset.price);
          if (rhodiumPrice === null) incomplete = true;
          else adders += rhodiumPrice;
        }
      } else {
        var checked = fieldset.querySelector("input:checked");
        detail.textContent = checked ? choiceName(checked) : "Not selected";
        if (!checked) {
          incomplete = true;
        } else {
          var adder = parseAmount(checked.dataset.price);
          if (adder === null) incomplete = true;
          else adders += adder;
        }
      }

      row.append(term, detail);
      rows.append(row);
    });

    list.replaceChildren(rows);
    total.textContent = incomplete ? "No total yet" : formatDollars(base + adders);
  }

  document.querySelectorAll(".setting").forEach(function (setting) {
    var form = setting.querySelector(".options");
    if (!form) return;
    var list = setting.querySelector(".readback-list");
    var total = setting.querySelector(".readback-total");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
    });
    form.addEventListener("change", function () {
      render(setting);
    });

    render(setting);
    if (list) list.setAttribute("aria-live", "polite");
    if (total) total.setAttribute("aria-live", "polite");
  });

  /* Gold quotes. See the note at the top of this file. */

  var TROY_GRAMS = 31.1034768;
  var STERLING_DENSITY = 10.36;
  var GOLD_LOSS = 1.2;
  var GOLD_DENSITY = { 14: 13.07, 18: 15.58 };
  var savedSpot = { gold: 4095, silver: 56.4, live: false };
  var spot = { gold: savedSpot.gold, silver: savedSpot.silver, live: false, pending: true };

  function roundQuote(amount) {
    var stepCents = 2500;
    var cents = Math.round(amount * 100);
    return Math.ceil((cents - 1) / stepCents) * stepCents / 100;
  }

  function formatGrams(grams) {
    return (Math.round(grams * 10) / 10).toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }

  function formatSpot(amount, digits) {
    return "$" + amount.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function goldQuote(grams, karat, goldOz, silverOz, silverRetail) {
    var finished = grams * GOLD_DENSITY[karat] / STERLING_DENSITY;
    var fine = finished * GOLD_LOSS * (karat / 24);
    var making = silverRetail - grams * 0.925 * (silverOz / TROY_GRAMS);
    var raw = making + fine * (goldOz / TROY_GRAMS);
    var quote = roundQuote(raw);
    return { finished: finished, quote: quote, addon: quote - silverRetail };
  }

  function spotSentence(current) {
    if (current.pending) return "Checking the gold price.";
    var gold = formatSpot(current.gold, 0);
    var silver = formatSpot(current.silver, 2);
    if (current.live) return "Gold " + gold + " an ounce, silver " + silver + " an ounce.";
    return "The live metal price did not load. Using gold " + gold + " an ounce and silver " + silver + " an ounce from October 22.";
  }

  function applyGold(setting, current) {
    var form = setting.querySelector(".options");
    var gramsInput = setting.querySelector('input[name="silver-grams"]');
    var weights = setting.querySelector(".gold-weights");
    var spotLine = setting.querySelector(".spot");
    if (!form || !gramsInput) return;

    if (spotLine) spotLine.textContent = spotSentence(current);

    var base = parseAmount(form.dataset.base);
    var grams = parseAmount(gramsInput.value);
    var goldInputs = form.querySelectorAll("input[data-karat]");
    var usable = base !== null && grams !== null && grams >= 0.1 && grams <= 40;

    if (!usable) {
      goldInputs.forEach(function (input) {
        delete input.dataset.price;
        var choice = input.closest(".choice");
        var price = choice && choice.querySelector(".choice-price");
        var detail = choice && choice.querySelector(".choice-detail");
        if (price) price.textContent = "—";
        if (detail) detail.textContent = grams === null || String(gramsInput.value).trim() === ""
          ? "Enter the sterling weight."
          : "Enter a sterling weight from 0.1 g to 40 g.";
      });
      if (weights) {
        weights.textContent = grams === null || String(gramsInput.value).trim() === ""
          ? "Enter the sterling weight."
          : "Enter a sterling weight from 0.1 g to 40 g.";
      }
      render(setting);
      return;
    }

    var lines = [];
    goldInputs.forEach(function (input) {
      var karat = Number(input.dataset.karat);
      if (!GOLD_DENSITY[karat]) return;
      var quote = goldQuote(grams, karat, current.gold, current.silver, base);
      input.dataset.price = String(quote.addon);
      var choice = input.closest(".choice");
      var price = choice && choice.querySelector(".choice-price");
      var detail = choice && choice.querySelector(".choice-detail");
      var finished = formatGrams(quote.finished) + " g";
      if (price) {
        price.textContent = quote.addon === 0 ? "Included" : (quote.addon > 0 ? "+" : "") + formatDollars(quote.addon);
      }
      if (detail) detail.textContent = "About " + finished + " finished. " + formatDollars(quote.quote) + " in " + karat + "k.";
      lines.push(finished + " in " + karat + "k");
    });

    if (weights && lines.length) {
      weights.textContent = "About " + lines.join(", and about ") + ".";
    }
    render(setting);
  }

  document.querySelectorAll(".setting").forEach(function (setting) {
    var gramsInput = setting.querySelector('input[name="silver-grams"]');
    if (!gramsInput) return;
    gramsInput.addEventListener("input", function () {
      applyGold(setting, spot);
    });
  });

  function readSpot(data) {
    var gold = Number(data && data.spot_usd_oz);
    var silver = Number(data && data.silver_usd_oz);
    if (!(gold > 500 && gold < 20000)) return null;
    if (!(silver > 5 && silver < 500)) return null;
    return { gold: gold, silver: silver, live: true };
  }

  fetch("https://xaus.com/api/v1/spot?compact=1", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("spot " + response.status);
      return response.json();
    })
    .then(function (data) {
      var live = readSpot(data);
      if (!live) throw new Error("spot shape");
      spot = live;
    })
    .catch(function () {
      spot = savedSpot;
    })
    .then(function () {
      document.querySelectorAll(".setting").forEach(function (setting) {
        applyGold(setting, spot);
      });
    });

  /* Drop a photo in images/<slug>/ and reload. main.jpg is preferred.
     jpeg, png, and webp with the same base name also show up. */
  var photoExtensions = ["jpg", "jpeg", "png", "webp"];

  document.querySelectorAll("img[data-base]").forEach(function (img) {
    var base = img.getAttribute("data-base");
    var mat = img.parentElement && img.parentElement.querySelector(".mat");
    var probe = new Image();
    var index = 0;
    var retried = false;

    function urlFor() {
      var url = base + "." + photoExtensions[index];
      if (retried) url += "?reload=" + Date.now();
      return url;
    }

    probe.onload = function () {
      img.src = probe.src;
      img.hidden = false;
      if (mat) mat.hidden = true;
    };
    probe.onerror = function () {
      if (!retried) {
        retried = true;
        probe.src = urlFor();
        return;
      }
      retried = false;
      index += 1;
      if (index < photoExtensions.length) probe.src = urlFor();
    };
    probe.src = urlFor();
  });

  function linkFor(id) {
    var url = new URL(window.location.href);
    url.hash = id;
    return url.toString();
  }

  function copyWithSelection(text) {
    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-999px";
      document.body.appendChild(area);
      area.select();
      var ok = document.execCommand("copy");
      area.remove();
      if (ok) resolve();
      else reject(new Error("copy failed"));
    });
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return copyWithSelection(text);
      });
    }
    return copyWithSelection(text);
  }

  document.querySelectorAll(".copy-link").forEach(function (button) {
    var label = button.textContent;
    button.addEventListener("click", function () {
      var id = button.getAttribute("data-id");
      copyText(linkFor(id)).then(function () {
        button.textContent = "Copied";
        window.setTimeout(function () {
          button.textContent = label;
        }, 2000);
      }).catch(function () {
        var link = button.parentElement && button.parentElement.querySelector("a");
        if (!link) return;
        var range = document.createRange();
        range.selectNodeContents(link);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      });
    });
  });

  function markCurrentSetting() {
    var id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    document.querySelectorAll(".style-index a").forEach(function (link) {
      var settingId = (link.getAttribute("href") || "").replace(/^#/, "");
      var current = id === settingId || id.indexOf(settingId + "-") === 0;
      if (current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function focusHashedSetting() {
    var id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  markCurrentSetting();
  focusHashedSetting();
  window.addEventListener("hashchange", function () {
    markCurrentSetting();
    focusHashedSetting();
  });
})();
