import { access, readdir, readFile } from "node:fs/promises";

const STERLING_DENSITY = 10.36;
const GOLD_DENSITY = { 14: 13.07, 18: 15.58 };
const VIDEO = new Set(["mp4", "webm"]);
const PHOTO = new Set(["jpg", "jpeg", "png", "webp"]);
const SITE_FIELDS = ["name", "tagline", "description", "intro", "skip", "footer"];
const SETTING_FIELDS = [
  "id", "title", "order", "lede", "grams", "hours", "rate", "weightNote",
  "stone", "about", "points", "media", "priceNote", "options",
  "fingerSize", "leadTime", "open",
];
const GROUP_FIELDS = ["name", "field", "rule", "choices", "addon"];
const CHOICE_FIELDS = ["name", "value", "price", "detail", "selected", "metal", "karat"];
const ADDON_FIELDS = ["name", "value", "price", "detail"];
const MEDIA_FIELDS = ["file", "caption", "alt"];

function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

function keysOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
}

function unknownKeys(file, value, allowed) {
  for (const key of keysOf(value)) {
    if (!allowed.includes(key)) fail(file, `"${key}" is not a field. Check the spelling.`);
  }
}

function needString(file, value, key) {
  const text = value[key];
  if (typeof text !== "string" || text.trim() === "") fail(file, `${key} needs text.`);
  return text;
}

function optionalString(file, value, key) {
  if (value[key] == null) return "";
  if (typeof value[key] !== "string" || value[key].trim() === "") fail(file, `${key} needs text.`);
  return value[key];
}

function needNumber(file, value, key) {
  const number = value[key];
  if (typeof number !== "number" || !Number.isFinite(number)) fail(file, `${key} needs a number.`);
  return number;
}

function stringList(file, value, key, required) {
  const list = value[key];
  if (list == null) {
    if (required) fail(file, `${key} needs a list.`);
    return [];
  }
  if (!Array.isArray(list) || list.some((item) => typeof item !== "string" || item.trim() === "")) {
    fail(file, `${key} needs a list of text.`);
  }
  if (required && list.length === 0) fail(file, `${key} needs a list.`);
  return list;
}

function extensionOf(fileName) {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

function formatGrams(grams) {
  return (Math.round(grams * 10) / 10).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function moneyLabel(price) {
  if (price === 0) return "Included";
  const sign = price > 0 ? "+" : "-";
  const abs = Math.abs(price);
  const body = Number.isInteger(abs)
    ? abs.toLocaleString("en-US")
    : abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return sign + "$" + body;
}

export function esc(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function loadSite() {
  const file = "site.json";
  const site = JSON.parse(await readFile(file, "utf8"));
  unknownKeys(file, site, SITE_FIELDS);
  for (const key of SITE_FIELDS) needString(file, site, key);
  return site;
}

async function listedMedia(file, dir, media) {
  if (!Array.isArray(media) || media.length === 0) fail(file, "media needs at least one photo or video.");
  const listed = new Set();
  const items = [];
  for (const item of media) {
    unknownKeys(file, item, MEDIA_FIELDS);
    const name = needString(file, item, "file");
    if (name !== name.split("/").pop() || name.includes("\\") || !/^[A-Za-z0-9._-]+$/.test(name)) {
      fail(file, `${name} needs to be a file name in this folder.`);
    }
    if (listed.has(name)) fail(file, `${name} is listed twice.`);
    listed.add(name);
    const ext = extensionOf(name);
    const kind = VIDEO.has(ext) ? "video" : PHOTO.has(ext) ? "photo" : "";
    if (!kind) fail(file, `${name} needs to be a jpg, jpeg, png, webp, mp4, or webm.`);
    const caption = needString(file, item, "caption");
    const alt = kind === "photo" ? needString(file, item, "alt") : "";
    try {
      await access(`${dir}/${name}`);
    } catch {
      fail(file, `${name} is not in this folder.`);
    }
    items.push({ file: name, kind, caption, alt });
  }

  const present = await readdir(dir);
  for (const name of present) {
    if (name.startsWith(".") || name === "setting.json" || name.endsWith(".txt")) continue;
    if (!listed.has(name)) fail(file, `${name} is not listed under media.`);
  }
  return items;
}

function choiceOf(file, group, choice) {
  unknownKeys(file, choice, CHOICE_FIELDS);
  const name = needString(file, choice, "name");
  const value = needString(file, choice, "value");
  const detail = optionalString(file, choice, "detail");
  const selected = choice.selected === true;
  if (choice.selected != null && choice.selected !== true && choice.selected !== false) {
    fail(file, `${name} selected needs to be true or false.`);
  }
  const isSilver = choice.metal === "silver";
  const karat = choice.karat;
  if (choice.metal != null && !isSilver) fail(file, `${name} metal needs to be silver.`);
  if (isSilver && karat != null) fail(file, `${name} cannot be silver and gold.`);
  if (isSilver || karat != null) {
    if (choice.price != null) fail(file, `${name} takes its price from the metal market. Remove price.`);
    if (karat != null && !GOLD_DENSITY[karat]) {
      fail(file, `${name} needs karat 14 or 18.`);
    }
    return { name, value, detail, selected, silver: isSilver, karat: karat ?? null, price: null };
  }
  const price = needNumber(file, choice, "price");
  return { name, value, detail, selected, silver: false, karat: null, price };
}

function optionsOf(file, options) {
  if (!Array.isArray(options) || options.length === 0) fail(file, "options needs a list.");
  const fields = new Set();
  let metalGroups = 0;
  const groups = options.map((group) => {
    unknownKeys(file, group, GROUP_FIELDS);
    const name = needString(file, group, "name");
    const field = needString(file, group, "field");
    if (!/^[a-z][a-z0-9-]*$/.test(field)) fail(file, `${name} field needs a short name like skirt.`);
    if (fields.has(field)) fail(file, `${field} is used on two options.`);
    fields.add(field);
    const rule = optionalString(file, group, "rule");
    const hasChoices = group.choices != null;
    const hasAddon = group.addon != null;
    if (hasChoices === hasAddon) fail(file, `${name} needs choices or one addon.`);
    if (field === "metal") metalGroups += 1;

    if (hasAddon) {
      unknownKeys(file, group.addon, ADDON_FIELDS);
      const addon = {
        name: needString(file, group.addon, "name"),
        value: needString(file, group.addon, "value"),
        price: needNumber(file, group.addon, "price"),
        detail: optionalString(file, group.addon, "detail"),
      };
      return { name, field, rule, choices: null, addon };
    }

    if (!Array.isArray(group.choices) || group.choices.length === 0) {
      fail(file, `${name} needs at least one choice.`);
    }
    const choices = group.choices.map((choice) => choiceOf(file, group, choice));
    const selected = choices.filter((choice) => choice.selected);
    if (selected.length > 1) fail(file, `${name} has more than one selected choice.`);
    if (selected.length === 0) choices[0].selected = true;
    if (field === "metal") {
      const silver = choices.filter((choice) => choice.silver);
      if (silver.length !== 1) fail(file, "Metal needs one sterling silver choice.");
    }
    return { name, field, rule, choices, addon: null };
  });
  if (metalGroups !== 1) fail(file, "options needs one Metal group.");
  return groups;
}

export async function loadSettings() {
  const root = "settings";
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    fail(root, "Add a folder for each setting.");
  }
  const settings = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = `${root}/${entry.name}`;
    const file = `${dir}/setting.json`;
    let raw;
    try {
      raw = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error && error.code === "ENOENT") fail(file, "is missing.");
      fail(file, `needs valid JSON. ${error.message}`);
    }
    unknownKeys(file, raw, SETTING_FIELDS);
    const id = needString(file, raw, "id");
    if (id !== entry.name) fail(file, `id is ${id}. The folder name needs to match.`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail(file, "id needs lowercase words separated by hyphens.");
    const grams = needNumber(file, raw, "grams");
    if (grams < 0.1 || grams > 40) fail(file, "grams needs to be between 0.1 and 40.");
    const hours = needNumber(file, raw, "hours");
    const rate = needNumber(file, raw, "rate");
    if (hours <= 0 || rate <= 0) fail(file, "hours and rate need to be greater than 0.");
    const order = raw.order == null ? 0 : needNumber(file, raw, "order");
    const points = raw.points == null ? [] : raw.points;
    if (!Array.isArray(points)) fail(file, "points needs a list.");
    for (const point of points) {
      needString(file, point, "name");
      needString(file, point, "text");
      unknownKeys(file, point, ["name", "text"]);
    }
    settings.push({
      id,
      title: needString(file, raw, "title"),
      order,
      lede: needString(file, raw, "lede"),
      grams,
      hours,
      rate,
      weightNote: optionalString(file, raw, "weightNote"),
      stone: needString(file, raw, "stone"),
      about: stringList(file, raw, "about", true),
      points,
      media: await listedMedia(file, dir, raw.media),
      priceNote: needString(file, raw, "priceNote"),
      options: optionsOf(file, raw.options),
      fingerSize: needString(file, raw, "fingerSize"),
      leadTime: needString(file, raw, "leadTime"),
      open: stringList(file, raw, "open", false),
      dir,
    });
  }
  if (settings.length === 0) fail(root, "Add a folder for each setting.");
  const ids = new Set();
  for (const setting of settings) {
    if (ids.has(setting.id)) fail(setting.dir, "two settings use this id.");
    ids.add(setting.id);
  }
  settings.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return settings;
}

export function workList(settings) {
  const work = {};
  for (const setting of settings) {
    work[`${setting.id}-options`] = { hours: setting.hours, rate: setting.rate };
  }
  return work;
}

function inputTag(parts) {
  const attrs = [`type="${parts.type}"`, `name="${esc(parts.name)}"`, `value="${esc(parts.value)}"`];
  if (parts.karat != null) attrs.push(`data-karat="${parts.karat}"`);
  if (parts.price != null) attrs.push(`data-price="${parts.price}"`);
  if (parts.checked) attrs.push("checked");
  if (parts.describedBy) attrs.push(`aria-describedby="${esc(parts.describedBy)}"`);
  return `<input ${attrs.join(" ")}>`;
}

function choiceHtml(choice, input) {
  const detail = choice.detail
    ? `\n                  <span class="choice-detail">${esc(choice.detail)}</span>`
    : "";
  return `              <label class="choice">
                ${input}
                <span class="choice-text">
                  <span class="choice-name">${esc(choice.name)}</span>${detail}
                </span>
                <span class="choice-price">${esc(choice.priceText)}</span>
              </label>`;
}

function fieldsetHtml(setting, group) {
  const lines = ["            <fieldset>", `              <legend>${esc(group.name)}</legend>`];
  let describedBy = "";
  if (group.rule) {
    describedBy = `${setting.id}-${group.field}-rule`;
    lines.push(`              <p class="rule" id="${esc(describedBy)}">${esc(group.rule)}</p>`);
  }
  if (group.addon) {
    lines.push(choiceHtml(group.addon, inputTag({
      type: "checkbox",
      name: group.field,
      value: group.addon.value,
      price: group.addon.price,
      describedBy,
    })));
  } else {
    for (const choice of group.choices) {
      lines.push(choiceHtml(choice, inputTag({
        type: "radio",
        name: group.field,
        value: choice.value,
        karat: choice.karat,
        price: choice.silver ? 0 : choice.price,
        checked: choice.selected,
      })));
    }
  }
  lines.push("            </fieldset>");
  return lines.join("\n");
}

function readbackHtml(groups) {
  return groups.map((group) => {
    let detail = "No";
    if (group.choices) {
      const selected = group.choices.find((choice) => choice.selected);
      detail = selected ? selected.name : "Not selected";
    }
    return `                <div><dt>${esc(group.name)}</dt><dd>${esc(detail)}</dd></div>`;
  }).join("\n");
}

function mediaFigure(setting, item, kind) {
  const pad = kind === "main" ? "          " : "            ";
  const inner = pad + "  ";
  const src = `images/${setting.id}/${item.file}`;
  const body = item.kind === "video"
    ? `${inner}<video class="setting-video" autoplay muted playsinline controls preload="metadata">
${inner}  <source src="${esc(src)}" type="video/${extensionOf(item.file)}">
${inner}</video>`
    : `${inner}<img src="${esc(src)}" alt="${esc(item.alt)}">`;
  return `${pad}<figure class="photo photo-${kind}">
${body}
${inner}<figcaption>${esc(item.caption)}</figcaption>
${pad}</figure>`;
}

function mediaHtml(setting) {
  const [main, ...rest] = setting.media;
  const lines = [mediaFigure(setting, main, "main")];
  if (rest.length) {
    lines.push("          <div class=\"photo-details\">");
    for (const item of rest) lines.push(mediaFigure(setting, item, "detail"));
    lines.push("          </div>");
  }
  return lines.join("\n");
}

function goldFallback(setting) {
  const karats = [];
  for (const group of setting.options) {
    for (const choice of group.choices || []) {
      if (choice.karat) karats.push(choice.karat);
    }
  }
  if (karats.length === 0) return "";
  const bits = karats.map((karat) => {
    const grams = setting.grams * GOLD_DENSITY[karat] / STERLING_DENSITY;
    return `${formatGrams(grams)} g in ${karat}k gold`;
  });
  if (bits.length === 1) return `About ${bits[0]}.`;
  return `About ${bits[0]}, and about ${bits.slice(1).join(", and about ")}.`;
}

function prepare(setting) {
  for (const group of setting.options) {
    if (group.addon) {
      group.addon.priceText = moneyLabel(group.addon.price);
    } else {
      for (const choice of group.choices) {
        if (choice.silver || choice.karat) {
          choice.priceText = "—";
          if (choice.karat && !choice.detail) choice.detail = "Price loading.";
        } else {
          choice.priceText = moneyLabel(choice.price);
        }
      }
    }
  }
  return setting;
}

function articleHtml(setting) {
  prepare(setting);
  const id = setting.id;
  const grams = formatGrams(setting.grams);
  const gold = goldFallback(setting);
  const about = setting.about.map((paragraph) => `            <p>${esc(paragraph)}</p>`).join("\n");
  const points = setting.points.length
    ? `            <ul class="points">
${setting.points.map((point) => `              <li><strong>${esc(point.name)}</strong> ${esc(point.text)}</li>`).join("\n")}
            </ul>`
    : "";
  const weightNote = setting.weightNote
    ? `\n                <p class="sample">${esc(setting.weightNote)}</p>`
    : "";
  const goldLine = gold
    ? `\n                <p class="gold-weights" id="${esc(id)}-gold-weights" aria-live="polite">${esc(gold)}</p>`
    : "";
  const open = setting.open.length
    ? `
          <section class="confirm" aria-labelledby="${esc(id)}-confirm">
            <h3 id="${esc(id)}-confirm">Still to fill in</h3>
            <ul>
${setting.open.map((item) => `              <li>${esc(item)}</li>`).join("\n")}
            </ul>
          </section>`
    : "";

  return `      <article class="setting" id="${esc(id)}" tabindex="-1" aria-labelledby="${esc(id)}-title">
        <header class="setting-heading">
          <h2 id="${esc(id)}-title">${esc(setting.title)}</h2>
          <p class="permalink">
            <a href="#${esc(id)}">#${esc(id)}</a>
            <button type="button" class="copy-link" data-id="${esc(id)}">Copy link</button>
          </p>
          <p class="lede">${esc(setting.lede)}</p>
        </header>

        <div class="setting-photos" id="${esc(id)}-photos" tabindex="-1">
${mediaHtml(setting)}
        </div>

        <div class="setting-body">
          <section class="about" aria-label="About this setting">
${about}
${points}
          </section>

          <dl class="facts">
            <div>
              <dt>Approximate finished weight</dt>
              <dd>
                <p>${esc(grams)} g in sterling silver.</p>${goldLine}${weightNote}
                <p class="spot" id="${esc(id)}-spot" aria-live="polite">Checking the metal price.</p>
              </dd>
            </div>
            <div>
              <dt>Stone size and shape</dt>
              <dd>${esc(setting.stone)}</dd>
            </div>
          </dl>

          <form class="options" id="${esc(id)}-options" tabindex="-1" data-base="" data-grams="${esc(grams)}" action="#">
            <p class="price-note">${esc(setting.priceNote)}</p>
${setting.options.map((group) => fieldsetHtml(setting, group)).join("\n\n")}

            <div class="readback">
              <h3>Selected options</h3>
              <dl class="readback-list">
${readbackHtml(setting.options)}
              </dl>
              <div class="readback-total">
                <span>Total</span>
                <strong>No total yet</strong>
              </div>
            </div>
          </form>

          <section class="order-notes">
            <h3>Finger size</h3>
            <p>${esc(setting.fingerSize)}</p>
            <h3>Lead time</h3>
            <p>${esc(setting.leadTime)}</p>
          </section>${open}
        </div>
      </article>`;
}

export function renderPage(template, site, settings) {
  const pageTitle = settings.length === 1 ? `${settings[0].title} — ${site.name}` : site.name;
  const replacements = {
    pageTitle: esc(pageTitle),
    description: esc(site.description),
    skip: esc(site.skip),
    name: esc(site.name),
    tagline: esc(site.tagline),
    intro: esc(site.intro),
    footer: esc(site.footer),
    navItems: settings.map((setting) => `          <li><a href="#${esc(setting.id)}">${esc(setting.title)}</a></li>`).join("\n"),
    articles: settings.map((setting) => articleHtml(setting)).join("\n\n"),
  };
  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    const token = `{{${key}}}`;
    if (!html.includes(token)) throw new Error(`index.html is missing ${token}.`);
    html = html.replace(token, () => value);
  }
  if (html.includes("{{")) throw new Error("index.html still has an unfilled token.");
  return html;
}
