const BOT_TOKEN = "8651775315:AAEAec6kxUsNl_B7mWSBADdp5NJgr6-GhQg";
const ADMIN_ID = 7692551897;
const WEBHOOK_SECRET = "mcfrom_secret_2026";
const WEBAPP_URL = "https://8ppai2-code.github.io/mcfrom-webapp/";
const CHANNEL_URL = "https://t.me/Addonox";

// ── TEXTS ──────────────────────────────────────────
const TEXTS = {
  ar: {
    menu: "🏠 *القائمة الرئيسية*\n\nمرحباً {name}، ماذا تريد؟",
    browse: "🎮 تصفح المودات",
    tools: "🔧 الأدوات",
    earn: "💰 Earn Minecoins",
    support: "💬 تواصل معنا",
    lang_change: "🌐 Change Language",
    soon: "⏳ قريباً...",
    support_msg: "اكتب مشكلتك هنا وستصل للمطورين 📥",
    support_received: "✅ تم إرسال رسالتك للمطورين!",
    banned: "🚫 أنت محظور من استخدام هذا البوت.",
  },
  en: {
    menu: "🏠 *Main Menu*\n\nHello {name}, what are you looking for?",
    browse: "🎮 Browse Mods",
    tools: "🔧 Tools",
    earn: "💰 Earn Minecoins",
    support: "💬 Contact Us",
    lang_change: "🌐 Change Language",
    soon: "⏳ Soon...",
    support_msg: "Write your issue here and it will reach the developers 📥",
    support_received: "✅ Your message has been sent to the developers!",
    banned: "🚫 You are banned from using this bot.",
  },
  ru: {
    menu: "🏠 *Главное меню*\n\nПривет {name}, что вы ищете?",
    browse: "🎮 Моды",
    tools: "🔧 Инструменты",
    earn: "💰 Earn Minecoins",
    support: "💬 Связаться",
    lang_change: "🌐 Change Language",
    soon: "⏳ Скоро...",
    support_msg: "Напишите вашу проблему, и она дойдёт до разработчиков 📥",
    support_received: "✅ Ваше сообщение отправлено разработчикам!",
    banned: "🚫 Вы заблокированы.",
  },
};

// ── TELEGRAM API HELPERS ───────────────────────────
async function api(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

const sendMessage  = (chatId, text, extra = {}) => api("sendMessage",  { chat_id: chatId, text, parse_mode: "Markdown", ...extra });
const editMessage  = (chatId, msgId, text, extra = {}) => api("editMessageText", { chat_id: chatId, message_id: msgId, text, parse_mode: "Markdown", ...extra });
const answerCB     = (id, text = "", alert = false) => api("answerCallbackQuery", { callback_query_id: id, text, show_alert: alert });
const sendPhoto    = (chatId, photo, caption, extra = {}) => api("sendPhoto", { chat_id: chatId, photo, caption, parse_mode: "Markdown", ...extra });
const forwardMsg   = (chatId, fromId, msgId) => api("forwardMessage", { chat_id: chatId, from_chat_id: fromId, message_id: msgId });

function getName(user) { return user.first_name || user.username || "Friend"; }

// ── KEYBOARDS ──────────────────────────────────────
function langKeyboard() {
  return { inline_keyboard: [
    [{ text: "🇸🇦   Arabic",  callback_data: "lang_ar" }],
    [{ text: "🇬🇧   English", callback_data: "lang_en" }],
    [{ text: "🇷🇺   Русский", callback_data: "lang_ru" }],
  ]};
}

function mainMenuKeyboard(lang) {
  const t = TEXTS[lang];
  return { inline_keyboard: [
    [{ text: t.browse, web_app: { url: WEBAPP_URL + "?page=addons" } }],
    [{ text: t.tools,  web_app: { url: WEBAPP_URL + "?page=tools"  } }],
    [
      { text: t.earn,    web_app: { url: WEBAPP_URL + "?page=earn"  } },
      { text: t.support, callback_data: "menu_support" },
    ],
    [{ text: t.lang_change, callback_data: "menu_lang" }],
  ]};
}

// ── ADMIN CHECK ────────────────────────────────────
function isAdmin(userId) { return userId === ADMIN_ID; }

// ── BAN SYSTEM ─────────────────────────────────────
async function isBanned(userId, env) {
  const v = await env.BOT_KV.get(`ban:${userId}`);
  return v === "1";
}

// ── USER COUNT ─────────────────────────────────────
async function addUser(userId, env) {
  const exists = await env.BOT_KV.get(`user:${userId}:started`);
  if (!exists) {
    const count = parseInt(await env.BOT_KV.get("stats:users") || "0") + 1;
    await env.BOT_KV.put("stats:users", String(count));
  }
}

// ── /start ─────────────────────────────────────────
async function handleStart(msg, env) {
  const userId = msg.from.id;
  const name   = getName(msg.from);
  await addUser(userId, env);
  const started = await env.BOT_KV.get(`user:${userId}:started`);
  if (!started) {
    await sendMessage(userId,
      "🌐  Choose your language\n      اختر لغتك\n      Выберите язык:",
      { reply_markup: langKeyboard() }
    );
  } else {
    const lang = (await env.BOT_KV.get(`user:${userId}:lang`)) || "en";
    await sendMessage(userId, TEXTS[lang].menu.replace("{name}", name), { reply_markup: mainMenuKeyboard(lang) });
  }
}

// ── ADMIN COMMANDS ─────────────────────────────────
async function handleAdmin(msg, env) {
  const text   = msg.text || "";
  const userId = msg.from.id;
  const parts  = text.trim().split(/\s+/);
  const cmd    = parts[0];

  // /users — عدد المستخدمين
  if (cmd === "/users") {
    const count = await env.BOT_KV.get("stats:users") || "0";
    await sendMessage(userId, `👥 *Total Users:* ${count}`);
    return true;
  }

  // /ban ID
  if (cmd === "/ban" && parts[1]) {
    const targetId = parts[1];
    await env.BOT_KV.put(`ban:${targetId}`, "1");
    await sendMessage(userId, `🚫 User \`${targetId}\` has been banned.`);
    return true;
  }

  // /unban ID
  if (cmd === "/unban" && parts[1]) {
    const targetId = parts[1];
    await env.BOT_KV.delete(`ban:${targetId}`);
    await sendMessage(userId, `✅ User \`${targetId}\` has been unbanned.`);
    return true;
  }

  // /addmod — مود مجاني في Add-ons
  if (cmd === "/addmod") {
    await env.BOT_KV.put(`admin:${userId}:mode`, "addmod");
    await sendMessage(userId,
      "📦 *Add Free Mod*\n\nSend the mod photo now.\n_(Reply with a photo + caption as mod name)_"
    );
    return true;
  }

  // /addmod2 — مود مجاني في Pass
  if (cmd === "/addmod2") {
    await env.BOT_KV.put(`admin:${userId}:mode`, "addmod2");
    await sendMessage(userId,
      "📦 *Add Free Pass Mod*\n\nSend the mod photo now.\n_(Reply with a photo + caption as mod name)_"
    );
    return true;
  }

  // /addmod3 — مود مدفوع في Pass
  if (cmd === "/addmod3") {
    await env.BOT_KV.put(`admin:${userId}:mode`, "addmod3");
    await sendMessage(userId,
      "💎 *Add Paid Pass Mod*\n\nSend the mod photo now.\n_(Reply with: photo + caption = name | price in stars)_\nExample caption: `Cool Mod | 50`"
    );
    return true;
  }

  // /pinmod name
  if (cmd === "/pinmod" && parts.slice(1).join(" ")) {
    const modName = parts.slice(1).join(" ");
    await env.BOT_KV.put("featured:mod", modName);
    await sendMessage(userId, `⭐ *${modName}* is now the Mod of the Week!`);
    return true;
  }

  return false;
}

// ── HANDLE PHOTO (addmod flow) ─────────────────────
async function handlePhoto(msg, env) {
  const userId = msg.from.id;
  if (!isAdmin(userId)) return;

  const mode = await env.BOT_KV.get(`admin:${userId}:mode`);
  if (!mode) return;

  await env.BOT_KV.delete(`admin:${userId}:mode`);

  const photo    = msg.photo?.[msg.photo.length - 1]?.file_id;
  const caption  = msg.caption || "New Mod";
  const parts    = caption.split("|").map(s => s.trim());
  const name     = parts[0];
  const price    = parts[1] || null;

  const key = `mod:${Date.now()}`;
  const modData = { id: key, name, img: photo, desc: "", tag: "Addon", likes: 0 };

  if (mode === "addmod") {
    modData.section = "addons";
  } else if (mode === "addmod2") {
    modData.section = "pass";
    modData.price   = null;
  } else if (mode === "addmod3") {
    modData.section = "pass";
    modData.price   = price || "99";
  }

  await env.BOT_KV.put(key, JSON.stringify(modData));

  // Add to section list
  const listKey = modData.section === "addons" ? "list:addons" : "list:pass";
  const list    = JSON.parse(await env.BOT_KV.get(listKey) || "[]");
  list.push(key);
  await env.BOT_KV.put(listKey, JSON.stringify(list));

  await sendMessage(userId,
    `✅ *${name}* added to *${modData.section}*!${price ? `\n💰 Price: ${price} ⭐` : ""}`
  );
}

// ── HANDLE CALLBACKS ───────────────────────────────
async function handleCallback(query, env) {
  const userId = query.from.id;
  const name   = getName(query.from);
  const data   = query.data;
  const msgId  = query.message.message_id;

  await answerCB(query.id);

  if (data.startsWith("lang_")) {
    const lang = data.split("_")[1];
    await env.BOT_KV.put(`user:${userId}:lang`, lang);
    await env.BOT_KV.put(`user:${userId}:started`, "1");
    await editMessage(userId, msgId, TEXTS[lang].menu.replace("{name}", name), {
      reply_markup: mainMenuKeyboard(lang),
    });
    return;
  }

  const lang = (await env.BOT_KV.get(`user:${userId}:lang`)) || "en";
  const t    = TEXTS[lang];

  if (data === "menu_lang") {
    await editMessage(userId, msgId,
      "🌐  Choose your language\n      اختر لغتك\n      Выберите язык:",
      { reply_markup: langKeyboard() }
    );
  } else if (data === "menu_earn") {
    await answerCB(query.id, t.soon, true);
  } else if (data === "menu_support") {
    await env.BOT_KV.put(`user:${userId}:waiting_support`, "1");
    await sendMessage(userId, t.support_msg);
  }
}

// ── MAIN MESSAGE HANDLER ───────────────────────────
async function handleMessage(msg, env) {
  const userId = msg.from.id;
  const text   = msg.text || "";

  // Ban check
  if (await isBanned(userId, env)) {
    const lang = (await env.BOT_KV.get(`user:${userId}:lang`)) || "en";
    await sendMessage(userId, TEXTS[lang].banned);
    return;
  }

  // /start
  if (text === "/start") { await handleStart(msg, env); return; }

  // Admin commands
  if (isAdmin(userId) && text.startsWith("/")) {
    const handled = await handleAdmin(msg, env);
    if (handled) return;
  }

  // Photo from admin (addmod flow)
  if (msg.photo && isAdmin(userId)) {
    await handlePhoto(msg, env);
    return;
  }

  // Support message
  const waiting = await env.BOT_KV.get(`user:${userId}:waiting_support`);
  if (waiting) {
    await env.BOT_KV.delete(`user:${userId}:waiting_support`);
    const lang = (await env.BOT_KV.get(`user:${userId}:lang`)) || "en";
    const name = getName(msg.from);
    await sendMessage(ADMIN_ID,
      `📥 *New Support Message*\n👤 ${name} (ID: \`${userId}\`)\n\n${text}`
    );
    await sendMessage(userId, TEXTS[lang].support_received);
    return;
  }
}

// ── FETCH (Webhook entry) ──────────────────────────
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("OK");
    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secret !== WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });

    const update = await request.json();
    if (update.message)        await handleMessage(update.message, env);
    else if (update.callback_query) await handleCallback(update.callback_query, env);

    return new Response("OK");
  },
};
