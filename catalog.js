/* Selected-option read-back, rhodium rule, and total.

   The build writes the price list below from site.json and each
   settings/<id>/setting.json. Per setting it holds three things:

     labor   the shop charge in dollars, already marked up
     grams   the finished sterling weight of the base piece
     metals  dollars per gram of that weight, by metal, marked up

   Hours, the hourly rate, and the markup stay in the source files.
   They are not written to the page.

   Price = labor + metals[metal] × (grams + extra grams), to the dollar,
   plus the flat price of each selected add-on.

   An option that uses more metal carries addGrams in setting.json, so a
   heavier shank costs more in gold than it does in silver. An option that
   is only labor carries price. An option can carry both.

   Antique finish clears and disables rhodium. */

(function () {
  var STERLING_DENSITY = 10.36;
  var GOLD_DENSITY = { 14: 13.07, 18: 15.58 };
  /* The build replaces this empty list. */
  var price = {};

  function parseAmount(value) {
    if (value == null) return null;
    var text = String(value).trim();
    if (text === "") return null;
    var amount = Number(text);
    return Number.isFinite(amount) ? amount : null;
  }

  function formatDollars(amount) {
    var dollars = Math.round(amount);
    var negative = dollars < 0;
    var body = Math.abs(dollars).toLocaleString("en-US");
    return (negative ? "-$" : "$") + body;
  }

  function moneyLabel(amount) {
    var dollars = Math.round(amount);
    if (dollars === 0) return "Included";
    return (dollars > 0 ? "+" : "") + formatDollars(dollars);
  }

  function formatGrams(grams) {
    return (Math.round(grams * 10) / 10).toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }

  function choiceName(input) {
    var choice = input.closest(".choice");
    var name = choice && choice.querySelector(".choice-name");
    return name ? name.textContent.replace(/\s+/g, " ").trim() : input.value;
  }

  function priceCell(input) {
    var choice = input.closest(".choice");
    return choice && choice.querySelector(".choice-price");
  }

  function detailCell(input) {
    var choice = input.closest(".choice");
    return choice && choice.querySelector(".choice-detail");
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

  /* Every input that is on and not a metal, so its weight and price count. */
  function activeAddOns(form) {
    var list = [];
    form.querySelectorAll("fieldset input").forEach(function (input) {
      if (input.name === "metal" || input.disabled || !input.checked) return;
      list.push(input);
    });
    return list;
  }

  function extraGramsOf(inputs) {
    var extra = 0;
    inputs.forEach(function (input) {
      extra += parseAmount(input.dataset.addGrams) || 0;
    });
    return extra;
  }

  function render(setting) {
    var form = setting.querySelector(".options");
    var list = setting.querySelector(".readback-list");
    var total = setting.querySelector(".readback-total strong");
    if (!form || !list || !total) return;

    syncRhodium(form);

    var job = price[form.id];
    var metalInput = form.querySelector('input[name="metal"]:checked');
    var perGram = job && metalInput ? job.metals[metalInput.value] : null;
    var incomplete = !job || perGram == null;

    var addOns = activeAddOns(form);
    var extra = extraGramsOf(addOns);
    var flat = 0;
    addOns.forEach(function (input) {
      var amount = parseAmount(input.dataset.price);
      if (amount === null) incomplete = true;
      else flat += amount;
    });

    /* Redraw each price, because a metal change moves the weight-based ones. */
    if (job && perGram != null) {
      form.querySelectorAll('input[name="metal"]').forEach(function (input) {
        var rate = job.metals[input.value];
        var cell = priceCell(input);
        if (rate == null || !cell) return;
        var quote = Math.round(job.labor + rate * (job.grams + extra));
        cell.textContent = formatDollars(quote);
        var karat = Number(input.dataset.karat);
        var detail = detailCell(input);
        if (detail && GOLD_DENSITY[karat]) {
          var finished = (job.grams + extra) * GOLD_DENSITY[karat] / STERLING_DENSITY;
          detail.textContent = "About " + formatGrams(finished) + " g finished.";
        }
      });

      form.querySelectorAll("fieldset input").forEach(function (input) {
        if (input.name === "metal") return;
        var cell = priceCell(input);
        if (!cell) return;
        var own = parseAmount(input.dataset.price);
        if (own === null) return;
        var grams = parseAmount(input.dataset.addGrams) || 0;
        cell.textContent = moneyLabel(own + perGram * grams);
      });

      var weights = setting.querySelector(".gold-weights");
      if (weights) {
        var lines = [];
        form.querySelectorAll("input[data-karat]").forEach(function (input) {
          var karat = Number(input.dataset.karat);
          if (!GOLD_DENSITY[karat]) return;
          var finished = (job.grams + extra) * GOLD_DENSITY[karat] / STERLING_DENSITY;
          lines.push(formatGrams(finished) + " g in " + karat + "k");
        });
        if (lines.length) {
          weights.textContent = "About " + lines.join(", and about ") + ".";
        }
      }
    }

    var rows = document.createDocumentFragment();
    form.querySelectorAll("fieldset").forEach(function (fieldset) {
      var legend = fieldset.querySelector("legend");
      var row = document.createElement("div");
      var term = document.createElement("dt");
      var detail = document.createElement("dd");
      term.textContent = legend ? legend.textContent.trim() : "";

      var addon = fieldset.querySelector('input[type="checkbox"]');
      if (addon) {
        if (addon.name === "rhodium" && addon.disabled) detail.textContent = "Unavailable with antique";
        else detail.textContent = addon.checked ? "Yes" : "No";
      } else {
        var checked = fieldset.querySelector("input:checked");
        detail.textContent = checked ? choiceName(checked) : "Not selected";
        if (!checked) incomplete = true;
      }

      row.append(term, detail);
      rows.append(row);
    });
    list.replaceChildren(rows);

    if (incomplete) {
      total.textContent = "No total yet";
      return;
    }
    total.textContent = formatDollars(job.labor + perGram * (job.grams + extra) + flat);
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

  function hashId() {
    return decodeURIComponent(window.location.hash.replace(/^#/, ""));
  }

  function openSetting() {
    var id = hashId();
    var match = null;
    document.querySelectorAll(".setting").forEach(function (setting) {
      if (id === setting.id || id.indexOf(setting.id + "-") === 0) match = setting;
    });
    return match;
  }

  function loadMedia(setting) {
    setting.querySelectorAll("img[data-src]").forEach(function (img) {
      if (!img.getAttribute("src")) img.src = img.getAttribute("data-src");
    });
    setting.querySelectorAll("video").forEach(function (video) {
      var source = video.querySelector("source[data-src]");
      if (source && !source.getAttribute("src")) {
        source.src = source.getAttribute("data-src");
        video.load();
      }
      var play = video.play();
      if (play && play.catch) play.catch(function () {});
    });
  }

  function pauseMedia(except) {
    document.querySelectorAll(".setting video").forEach(function (video) {
      if (except && except.contains(video)) return;
      video.pause();
    });
  }

  function markCurrentSetting() {
    var id = hashId();
    document.querySelectorAll(".style-index a").forEach(function (link) {
      var settingId = (link.getAttribute("href") || "").replace(/^#/, "");
      var current = id === settingId || id.indexOf(settingId + "-") === 0;
      if (current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function showView() {
    var open = openSetting();
    document.body.classList.toggle("is-setting", Boolean(open));
    document.body.classList.toggle("is-list", !open);
    if (open) loadMedia(open);
    pauseMedia(open);
    markCurrentSetting();
  }

  function focusHashedSetting() {
    var id = hashId();
    if (!id || id === "catalog") return;
    var target = document.getElementById(id);
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  showView();
  focusHashedSetting();
  window.addEventListener("hashchange", function () {
    showView();
    focusHashedSetting();
  });
})();
