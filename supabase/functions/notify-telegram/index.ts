import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "💳 To'lov kutilmoqda",
  pending:          "⏳ Kutilmoqda",
  confirmed:        "✅ Tasdiqlangan",
  delivering:       "🚚 Yetkazilmoqda",
  delivered:        "📦 Yetkazilgan",
  cancelled:        "❌ Bekor qilingan",
};

const PAYMENT_LABELS: Record<string, string> = {
  cod:   "💵 Naqd — yetkazib berishda",
  click: "💳 Click (online)",
};

function paymentLabel(order: any): string {
  if (order?.payment_method && PAYMENT_LABELS[order.payment_method]) {
    return PAYMENT_LABELS[order.payment_method];
  }
  // Eski yozuvlar yoki migratsiyadan oldingi buyurtmalar uchun status bo'yicha taxmin.
  if (order?.status === "awaiting_payment") return PAYMENT_LABELS.click;
  return PAYMENT_LABELS.cod;
}

function formatItems(items: unknown): string {
  if (!Array.isArray(items)) return JSON.stringify(items);
  return items
    .map((i: any) => {
      const name = i?.product_name || i?.name || "Mahsulot";
      const qty = Number(i?.quantity ?? 1);
      const price = Number(i?.price ?? 0);
      const priceStr = Number.isFinite(price) ? price.toLocaleString() : "0";
      return `  • ${name} x${qty} — ${priceStr} so'm`;
    })
    .join("\n");
}

function buildOrderText(order: any, opts?: { isNew?: boolean }): string {
  const idShort = String(order.id).slice(0, 8).toUpperCase();
  const title = opts?.isNew
    ? `🆕 <b>YANGI BUYURTMA #${idShort}</b>`
    : `🛍 <b>BUYURTMA #${idShort}</b>`;

  return [
    title,
    "",
    `👤 <b>Mijoz:</b> ${order.full_name ?? "-"}`,
    `📞 <b>Telefon:</b> ${order.phone ?? "-"}`,
    `📍 <b>Manzil:</b> ${order.address ?? "-"}`,
    order.note ? `📝 <b>Izoh:</b> ${order.note}` : null,
    "",
    `🧾 <b>Mahsulotlar:</b>`,
    formatItems(order.items),
    "",
    `💳 <b>To'lov usuli:</b> ${paymentLabel(order)}`,
    `💰 <b>Jami:</b> ${Number(order.total ?? 0).toLocaleString()} so'm`,
    `📊 <b>Holat:</b> ${STATUS_LABELS[order.status] || order.status}`,
    `🕐 <b>Vaqt:</b> ${new Date(order.created_at).toLocaleString("uz-UZ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendTelegram(text: string, keyboard?: object) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error("Telegram konfiguratsiya yo'q: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID");
    return { ok: false, error: "no telegram config" };
  }

  const body: Record<string, unknown> = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "HTML",
  };
  if (keyboard) body.reply_markup = keyboard;

  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const result = await res.json();
  if (!result.ok) console.error("Telegram sendMessage error:", JSON.stringify(result));
  return result;
}

function buildKeyboard(orderId: string, currentStatus: string) {
  // Tugmalarni status bo'yicha aniq belgilab beramiz.
  // awaiting_payment uchun "Tasdiqlash" tugmasi YO'Q — Click avtomatik tasdiqlaydi.
  const buttons: Array<{ text: string; callback_data: string }> = [];

  const NEXT: Record<string, { text: string; status: string }> = {
    pending:    { text: "✅ Tasdiqlash",   status: "confirmed"  },
    confirmed:  { text: "🚚 Yetkazilmoqda", status: "delivering" },
    delivering: { text: "📦 Yetkazildi",    status: "delivered"  },
  };

  const next = NEXT[currentStatus];
  if (next) {
    buttons.push({ text: next.text, callback_data: `status:${orderId}` });
  }

  if (currentStatus !== "cancelled" && currentStatus !== "delivered") {
    buttons.push({ text: "❌ Bekor qilish", callback_data: `cancel:${orderId}` });
  }

  return { inline_keyboard: buttons.length > 0 ? [buttons] : [] };
}

function nextStatusFor(currentStatus: string): string | null {
  const map: Record<string, string> = {
    pending:    "confirmed",
    confirmed:  "delivering",
    delivering: "delivered",
  };
  return map[currentStatus] ?? null;
}

async function answerCallback(callbackId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackId, text }),
      },
    );
  } catch (err) {
    console.error("answerCallback error:", String(err));
  }
}

async function editTelegramMessage(
  chatId: number | string,
  messageId: number,
  text: string,
  keyboard: object,
) {
  if (!TELEGRAM_BOT_TOKEN) return;
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }),
    },
  );
}

serve(async (req) => {
  // Telegram webhook GET bilan ham sog'liqni tekshirishi mumkin — 200 qaytaramiz.
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  try {
    const body = await req.json();

    // ---------- 1) Telegram callback_query (tugma bosildi) ----------
    if (body?.callback_query) {
      // Telegram dan kelganligini tekshirish: TELEGRAM_WEBHOOK_SECRET
      // o'rnatilgan bo'lsa, X-Telegram-Bot-Api-Secret-Token headerini solishtirамiz.
      const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
      if (secret) {
        const incoming = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (incoming !== secret) {
          console.warn("notify-telegram: callback_query - invalid secret token");
          return new Response("Unauthorized", { status: 401 });
        }
      }

      const cb = body.callback_query;
      const data: string = cb?.data ?? "";
      const [action, orderId] = data.split(":");

      if (!action || !orderId) {
        await answerCallback(cb.id, "Noto'g'ri so'rov");
        return new Response("ok");
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (orderErr || !order) {
        await answerCallback(cb.id, "Buyurtma topilmadi");
        return new Response("ok");
      }

      if (action === "status") {
        const next = nextStatusFor(order.status);
        if (!next) {
          await answerCallback(cb.id, "Bu buyurtmani o'zgartirib bo'lmaydi");
          return new Response("ok");
        }

        const { data: updated, error: updErr } = await supabase
          .from("orders")
          .update({ status: next })
          .eq("id", orderId)
          .select("*")
          .maybeSingle();

        if (updErr || !updated) {
          console.error("status update error:", updErr);
          await answerCallback(cb.id, "Xatolik yuz berdi");
          return new Response("ok");
        }

        await editTelegramMessage(
          cb.message.chat.id,
          cb.message.message_id,
          buildOrderText(updated),
          buildKeyboard(orderId, next),
        );
        await answerCallback(cb.id, `Status: ${STATUS_LABELS[next] ?? next}`);
        return new Response("ok");
      }

      if (action === "cancel") {
        const { data: updated, error: updErr } = await supabase
          .from("orders")
          .update({ status: "cancelled" })
          .eq("id", orderId)
          .select("*")
          .maybeSingle();

        if (updErr || !updated) {
          console.error("cancel update error:", updErr);
          await answerCallback(cb.id, "Xatolik yuz berdi");
          return new Response("ok");
        }

        await editTelegramMessage(
          cb.message.chat.id,
          cb.message.message_id,
          buildOrderText(updated),
          { inline_keyboard: [] },
        );
        await answerCallback(cb.id, "Buyurtma bekor qilindi");
        return new Response("ok");
      }

      await answerCallback(cb.id, "Noma'lum amal");
      return new Response("ok");
    }

    // ---------- 2) Supabase Database Webhook (yangi buyurtma) ----------
    // Supabase webhook payload: { type, table, record, schema, old_record }
    const record = body?.record ?? body?.new ?? null;
    if (!record) {
      console.log("No record in body. Keys:", Object.keys(body ?? {}));
      return new Response("no record", { status: 400 });
    }

    const text = buildOrderText(record, { isNew: true });
    await sendTelegram(text, buildKeyboard(record.id, record.status));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-telegram error:", String(err));
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
