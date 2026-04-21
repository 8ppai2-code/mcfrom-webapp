// ─────────────────────────────────────────────────
//  MC FROM — Cloudflare Worker
//  Bot (Telegram Webhook) + API (D1 Backend)
// ─────────────────────────────────────────────────

const BOT_TOKEN      = "8651775315:AAEAec6kxUsNl_B7mWSBADdp5NJgr6-GhQg";
const ADMIN_ID       = 7692551897;
const WEBHOOK_SECRET = "mcfrom_secret_2026";
const WEBAPP_URL     = "https://8ppai2-code.github.io/mcfrom-webapp/";
const API_SECRET     = "mcfrom_api_2026";

// ── CORS HEADERS ───────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-API-Secret",
  "Content-Type": "application/json",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

// ── TELEGRAM HELPERS ───────────────────────────────
const api      = (m, b) => fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${m}`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(b) }).then(r => r.json());
const send     = (id, text, extra={}) => api("sendMessage",  { chat_id:id, text, parse_mode:"Markdown", ...extra });
const sendPhoto = (id, photo, caption, extra={}) => api("sendPhoto", { chat_id:id, photo, caption, parse_mode:"Markdown", ...extra });
const edit     = (id, mid, text, extra={}) => api("editMessageText", { chat_id:id, message_id:mid, text, parse_mode:"Markdown", ...extra });
const answer   = (id, text="", alert=false) => api("answerCallbackQuery", { callback_query_id:id, text, show_alert:alert });
const getName  = u => u.first_name || u.username || "Friend";
const isAdmin  = id => id === ADMIN_ID;

// ── KEYBOARDS ──────────────────────────────────────

// زر 1: Browse Add-ons — primary (أزرق) عبر web_app
// زر 4: أزرار اللغة ملونة: Arabic=success, English=primary, Русский=danger
const langKB = () => ({ inline_keyboard: [
  [{ text:"🟢 🇸🇦   Arabic",  callback_data:"lang_ar" }],  // success = أخضر
  [{ text:"🔵 🇬🇧   English", callback_data:"lang_en" }],  // primary = أزرق
  [{ text:"🔴 🇷🇺   Русский", callback_data:"lang_ru" }],  // danger  = أحمر
]});

// ملاحظة: تليجرام لا يدعم ألوان حقيقية للأزرار — نستخدم إيموجي للتمييز البصري

const TEXTS = {
  ar: {
    menu:        "🏠 *القائمة الرئيسية*\n\nمرحباً {name}، ماذا تريد؟",
    browse:      "🔵 🎮 تصفح الإضافات",   // Browse Add-ons — أزرق
    tools:       "🔧 الأدوات",
    earn:        "💰 Earn Minecoins",
    support:     "💬 تواصل معنا",
    lang:        "🌐 Change Language",
    soon:        "⏳ قريباً...",
    support_msg: "اكتب مشكلتك هنا رسالة نصية فقط وستصل للمطورين 📥",
    support_ok:  "✅ تم إرسال رسالتك!",
    banned:      "🚫 أنت محظور.",
  },
  en: {
    menu:        "🏠 *Main Menu*\n\nHello {name}, what are you looking for?",
    browse:      "🔵 🎮 Browse Add-ons",   // Browse Add-ons — أزرق
    tools:       "🔧 Tools",
    earn:        "💰 Earn Minecoins",
    support:     "💬 Contact Us",
    lang:        "🌐 Change Language",
    soon:        "⏳ Soon...",
    support_msg: "Write your issue here (text only) and it will reach the developers 📥",
    support_ok:  "✅ Your message has been sent!",
    banned:      "🚫 You are banned.",
  },
  ru: {
    menu:        "🏠 *Главное меню*\n\nПривет {name}, что вы ищете?",
    browse:      "🔵 🎮 Просмотр дополнений",  // Browse Add-ons — أزرق
    tools:       "🔧 Инструменты",
    earn:        "💰 Earn Minecoins",
    support:     "💬 Связаться",
    lang:        "🌐 Change Language",
    soon:        "⏳ Скоро...",
    support_msg: "Напишите вашу проблему (только текст) и она дойдёт до разработчиков 📥",
    support_ok:  "✅ Сообщение отправлено!",
    banned:      "🚫 Вы заблокированы.",
  },
};

const menuKB = lang => ({ inline_keyboard: [
  [{ text: TEXTS[lang].browse,  web_app: { url: WEBAPP_URL + "?page=addons" } }],
  [{ text: TEXTS[lang].tools,   web_app: { url: WEBAPP_URL + "?page=tools"  } }],
  [
    { text: TEXTS[lang].earn,    web_app: { url: WEBAPP_URL + "?page=earn" } },
    { text: TEXTS[lang].support, callback_data: "menu_support" },
  ],
  [{ text: TEXTS[lang].lang, callback_data: "menu_lang" }],
]});

// ── D1 HELPERS ─────────────────────────────────────
const dbRun   = (db, sql, params=[]) => db.prepare(sql).bind(...params).run();
const dbAll   = (db, sql, params=[]) => db.prepare(sql).bind(...params).all();
const dbFirst = (db, sql, params=[]) => db.prepare(sql).bind(...params).first();

// ── BOT HANDLERS ───────────────────────────────────
async function handleStart(msg, env) {
  const uid  = msg.from.id;
  const name = getName(msg.from);
  try { await dbRun(env.DB, "INSERT OR IGNORE INTO users (id, name, lang) VALUES (?, ?, 'en')", [String(uid), name]); } catch(e){}
  const started = await env.BOT_KV.get(`user:${uid}:started`);
  if (!started) {
    await send(uid, "🌐  Choose your language\n      اختر لغتك\n      Выберите язык:", { reply_markup: langKB() });
  } else {
    const lang = (await env.BOT_KV.get(`user:${uid}:lang`)) || "en";
    await send(uid, TEXTS[lang].menu.replace("{name}", name), { reply_markup: menuKB(lang) });
  }
}

async function handleCallback(query, env) {
  const uid  = query.from.id;
  const name = getName(query.from);
  const data = query.data;
  const mid  = query.message.message_id;
  await answer(query.id);

  if (data.startsWith("lang_")) {
    const lang = data.split("_")[1];
    await env.BOT_KV.put(`user:${uid}:lang`, lang);
    await env.BOT_KV.put(`user:${uid}:started`, "1");
    await edit(uid, mid, TEXTS[lang].menu.replace("{name}", name), { reply_markup: menuKB(lang) });
    return;
  }

  const lang = (await env.BOT_KV.get(`user:${uid}:lang`)) || "en";

  if (data === "menu_lang") {
    await edit(uid, mid, "🌐  Choose your language\n      اختر لغتك\n      Выберите язык:", { reply_markup: langKB() });

  } else if (data === "menu_support") {
    await env.BOT_KV.put(`user:${uid}:waiting_support`, "1");
    await send(uid, TEXTS[lang].support_msg);

  // ── تأكيد الأخبار ──────────────────────────────
  } else if (data === "news_confirm") {
    const newsRaw = await env.BOT_KV.get(`admin:news_pending`);
    if (!newsRaw) { await send(uid, "❌ No pending news found."); return; }
    const news = JSON.parse(newsRaw);
    await env.BOT_KV.delete("admin:news_pending");

    // إرسال لجميع المستخدمين
    let sent = 0, failed = 0;
    try {
      const users = await dbAll(env.DB, "SELECT id FROM users");
      for (const user of users.results || []) {
        try {
          if (news.photo) {
            await sendPhoto(user.id, news.photo, news.text || "");
          } else {
            await send(user.id, news.text);
          }
          sent++;
        } catch(e) { failed++; }
      }
    } catch(e) {}

    await send(uid, `📢 *News sent!*\n✅ Sent: ${sent}\n❌ Failed: ${failed}`);

  } else if (data === "news_cancel") {
    await env.BOT_KV.delete("admin:news_pending");
    await send(uid, "❌ News cancelled.");
  }
}

async function handleMessage(msg, env) {
  const uid  = msg.from.id;
  const text = msg.text || "";

  // Ban check
  if (await env.BOT_KV.get(`ban:${uid}`)) {
    const lang = (await env.BOT_KV.get(`user:${uid}:lang`)) || "en";
    await send(uid, TEXTS[lang].banned);
    return;
  }

  if (text === "/start") { await handleStart(msg, env); return; }

  // Admin commands
  if (isAdmin(uid) && text.startsWith("/")) {
    await handleAdminCmd(msg, env);
    return;
  }

  // Admin: إرسال صورة مع الأخبار (إذا كان ينتظر صورة)
  if (isAdmin(uid) && msg.photo) {
    const waiting = await env.BOT_KV.get("admin:waiting_news_photo");
    if (waiting) {
      await env.BOT_KV.delete("admin:waiting_news_photo");
      const newsText = waiting;
      const photo = msg.photo[msg.photo.length - 1].file_id;
      const pending = JSON.stringify({ text: newsText, photo });
      await env.BOT_KV.put("admin:news_pending", pending);

      await send(uid, `📢 *News Preview:*\n\n${newsText}\n\n_+ Photo attached_\n\nهل تريد إرسالها لجميع المستخدمين؟`, {
        reply_markup: { inline_keyboard: [[
          { text: "✅ تأكيد الإرسال", callback_data: "news_confirm" },
          { text: "❌ إلغاء",         callback_data: "news_cancel"  },
        ]]}
      });
      return;
    }
  }

  // Support message
  const waiting = await env.BOT_KV.get(`user:${uid}:waiting_support`);
  if (waiting) {
    // تأكد إنه نص فقط
    if (msg.photo || msg.video || msg.document || msg.sticker) {
      const lang = (await env.BOT_KV.get(`user:${uid}:lang`)) || "en";
      await send(uid, TEXTS[lang].support_msg);
      return;
    }
    await env.BOT_KV.delete(`user:${uid}:waiting_support`);
    const lang = (await env.BOT_KV.get(`user:${uid}:lang`)) || "en";
    await send(ADMIN_ID, `📥 *Support Message*\n👤 ${getName(msg.from)} (ID: \`${uid}\`)\n\n${text}`);
    await send(uid, TEXTS[lang].support_ok);
  }
}

async function handleAdminCmd(msg, env) {
  const uid   = msg.from.id;
  const text  = msg.text || "";
  const parts = text.trim().split(/\s+/);
  const cmd   = parts[0];

  // /users — عدد المستخدمين
  if (cmd === "/users") {
    try {
      const res = await dbFirst(env.DB, "SELECT COUNT(*) as c FROM users");
      await send(uid, `👥 *Total Users:* ${res?.c || 0}`);
    } catch(e) {
      await send(uid, `👥 *Total Users:* unknown`);
    }

  // /ban ID
  } else if (cmd === "/ban" && parts[1]) {
    await env.BOT_KV.put(`ban:${parts[1]}`, "1");
    await send(uid, `🚫 User \`${parts[1]}\` banned.`);

  // /unban ID
  } else if (cmd === "/unban" && parts[1]) {
    await env.BOT_KV.delete(`ban:${parts[1]}`);
    await send(uid, `✅ User \`${parts[1]}\` unbanned.`);

  // /mods — قائمة آخر مودات
  } else if (cmd === "/mods") {
    try {
      const res = await dbAll(env.DB, "SELECT name, section FROM mods ORDER BY created_at DESC LIMIT 10");
      const list = res.results.map(m => `• ${m.name} (${m.section})`).join("\n") || "No mods yet";
      await send(uid, `📦 *Latest Mods:*\n${list}`);
    } catch(e) {
      await send(uid, "❌ DB error: " + e.message);
    }

  // /news نص الخبر — إرسال خبر لجميع المستخدمين
  } else if (cmd === "/news") {
    const newsText = parts.slice(1).join(" ");
    if (!newsText) {
      await send(uid, "📢 استخدام الأمر:\n`/news نص الخبر`\n\nأو أرسل `/news نص` ثم أرسل صورة");
      return;
    }

    // حفظ النص وانتظار صورة اختيارية
    await env.BOT_KV.put("admin:waiting_news_photo", newsText, { expirationTtl: 300 });
    await send(uid,
      `📢 *News Ready:*\n\n${newsText}\n\n` +
      `هل تريد إضافة صورة؟\n• أرسل صورة الآن لإرفاقها\n• أو اضغط تأكيد لإرسالها نصاً فقط`,
      { reply_markup: { inline_keyboard: [[
        { text: "✅ إرسال بدون صورة", callback_data: "news_confirm" },
        { text: "❌ إلغاء",            callback_data: "news_cancel"  },
      ]]}}
    );
    // حفظ نسخة بدون صورة أيضاً للتأكيد المباشر
    await env.BOT_KV.put("admin:news_pending", JSON.stringify({ text: newsText, photo: null }));

  } else {
    await send(uid, `❓ Unknown command.\n\nAvailable:\n/users\n/ban ID\n/unban ID\n/mods\n/news نص الخبر`);
  }
}

// ── API ROUTES ─────────────────────────────────────
async function handleAPI(request, env, path) {
  const method = request.method;
  if (method === "OPTIONS") return new Response("", { headers: CORS });

  const secret = request.headers.get("X-API-Secret");
  const isAuth = secret === API_SECRET;

  if (path === "/api/mods" && method === "GET") {
    try {
      const addons   = await dbAll(env.DB, "SELECT * FROM mods WHERE section='addons' ORDER BY created_at DESC");
      const pass     = await dbAll(env.DB, "SELECT * FROM mods WHERE section!='addons' ORDER BY created_at DESC");
      const featured = await dbFirst(env.DB, "SELECT id FROM mods WHERE featured=1 LIMIT 1");
      return json({ addons: addons.results||[], pass: pass.results||[], featured: featured?.id||null });
    } catch(e) {
      return json({ addons:[], pass:[], featured:null });
    }
  }

  if (path === "/api/mods" && method === "POST") {
    if (!isAuth) return json({ error: "Unauthorized" }, 401);
    const body = await request.json();
    const { name, desc, tag, section, img_url, link, price } = body;
    if (!name || !img_url) return json({ error: "name and img_url required" }, 400);
    const id = "mod_" + Date.now();
    await dbRun(env.DB,
      "INSERT INTO mods (id,name,desc,tag,section,img_url,link,price,likes,featured,created_at) VALUES (?,?,?,?,?,?,?,?,0,0,?)",
      [id, name, desc||"", tag||"Addon", section||"addons", img_url, link||"", price||null, new Date().toISOString()]
    );
    return json({ success: true, id });
  }

  if (path.startsWith("/api/mods/") && method === "PUT") {
    if (!isAuth) return json({ error: "Unauthorized" }, 401);
    const id = path.split("/")[3];
    const { name, desc, tag, img_url, link, price } = await request.json();
    await dbRun(env.DB, "UPDATE mods SET name=?,desc=?,tag=?,img_url=?,link=?,price=? WHERE id=?",
      [name, desc, tag, img_url, link, price||null, id]);
    return json({ success: true });
  }

  if (path.startsWith("/api/mods/") && method === "DELETE") {
    if (!isAuth) return json({ error: "Unauthorized" }, 401);
    const id = path.split("/")[3];
    await dbRun(env.DB, "DELETE FROM mods WHERE id=?", [id]);
    return json({ success: true });
  }

  if (path.startsWith("/api/pin/") && method === "POST") {
    if (!isAuth) return json({ error: "Unauthorized" }, 401);
    const id = path.split("/")[3];
    await dbRun(env.DB, "UPDATE mods SET featured=0");
    await dbRun(env.DB, "UPDATE mods SET featured=1 WHERE id=?", [id]);
    return json({ success: true });
  }

  if (path === "/api/unpin" && method === "POST") {
    if (!isAuth) return json({ error: "Unauthorized" }, 401);
    await dbRun(env.DB, "UPDATE mods SET featured=0");
    return json({ success: true });
  }

  if (path.startsWith("/api/like/") && method === "POST") {
    const id = path.split("/")[3];
    await dbRun(env.DB, "UPDATE mods SET likes=likes+1 WHERE id=?", [id]);
    return json({ success: true });
  }

  return json({ error: "Not found" }, 404);
}

// ── DB INIT ────────────────────────────────────────
async function initDB(env) {
  try {
    await dbRun(env.DB, `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      lang TEXT DEFAULT 'en',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch(e) {}
}

// ── MAIN FETCH ─────────────────────────────────────
export default {
  async fetch(request, env) {
    const url  = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/api/")) {
      await initDB(env);
      return handleAPI(request, env, path);
    }

    if (request.method !== "POST") return new Response("MC From Bot ✅");
    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secret !== WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });

    const update = await request.json();
    if (update.message)              await handleMessage(update.message, env);
    else if (update.callback_query)  await handleCallback(update.callback_query, env);

    return new Response("OK");
  },
};
