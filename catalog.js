/* Selected-option read-back, rhodium rule, and total.

   The sterling base lives on the form as data-base="180".
   Each choice's add-on lives on its input as data-price="40".
   Use data-price="0" for an option that is part of the base.
   Gold's data-price is the extra over sterling.
   Leave an attribute empty while that amount is still a blank.
   The total stays "No total yet" until the base and every selected
   add-on are numbers. Antique finish clears and disables rhodium. */

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
