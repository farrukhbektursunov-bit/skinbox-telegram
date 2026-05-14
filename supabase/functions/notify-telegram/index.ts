import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

const STATUS_LABELS: Record<string, string> = {
  pending:    "⏳ Kutilmoqda",
  confirmed:  "✅ Tasdiqlangan",
  delivering: "🚚 Yetkazilmoqda",
  delivered:  "📦 Yetkazilgan",
  cancelled:  "❌ Bekor qilingan",
};

async function sendTelegram(text: string, keyboard?: object) {
  console.log("TOKEN exists:", !!TELEGRAM_BOT_TOKEN);
  console.log("CHAT_ID:", TELEGRAM_CHAT_ID);

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
    }
  );

  const result = await res.json();
  console.log("Telegram response:", JSON.stringify(result));
  return result;
}

function buildKeyboard(orderId: string, currentStatus: string) {
  const statusFlow = ["pending", "confirmed", "delivering", "delivered"];
  const currentIndex = statusFlow.indexOf(currentStatus);
  const nextStatus = statusFlow[currentIndex + 1];
  const buttons = [];

  if (nextStatus) {
    const nextLabel: Record<string, string> = {
      confirmed:  "✅ Tasdiqlash",
      delivering: "🚚 Yetkazilmoqda",
      delivered:  "📦 Yetkazildi",
    };
    buttons.push({
      text: nextLabel[nextStatus] || nextStatus,
      callback_data: `status:${orderId}`,
    });
  }

  if (currentStatus !== "cancelled" && currentStatus !== "delivered") {
    buttons.push({
      text: "❌ Bekor qilish",
      callback_data: `cancel:${orderId}`,
    });
  }

  return { inline_keyboard: buttons.length > 0 ? [buttons] : [] };
}

serve(async (req) => {
  try {
    const body = await req.json();
    console.log("Request body keys:", Object.keys(body));

    if (body.callback_query) {
      const cb = body.callback_query;
      const [action, orderId] = cb.data.split(":");

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      if (action === "status") {
        const { data: order } = await supabase
          .from("orders").select("*").eq("id", orderId).single();

        const statusFlow = ["pending", "confirmed", "delivering", "delivered"];
        const currentIndex = statusFlow.indexOf(order.status);
        const nextStatus = statusFlow[currentIndex + 1];

        if (!nextStatus) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: cb.id, text: "Allaqachon yetkazilgan!" }),
          });
          return new Response("ok");
        }

        await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);

        const items = Array.isArray(order.items)
          ? order.items.map((i: any) => `  • ${i.name} x${i.quantity} — ${i.price?.toLocaleString()} so'm`).join("\n")
          : JSON.stringify(order.items);

        const updatedText = [
          `🛍 <b>BUYURTMA #${order.id.slice(0, 8).toUpperCase()}</b>`,
          "",
          `👤 <b>Mijoz:</b> ${order.full_name}`,
          `📞 <b>Telefon:</b> ${order.phone}`,
          `📍 <b>Manzil:</b> ${order.address}`,
          order.note ? `📝 <b>Izoh:</b> ${order.note}` : null,
          "",
          `🧾 <b>Mahsulotlar:</b>`,
          items,
          "",
          `💰 <b>Jami:</b> ${Number(order.total).toLocaleString()} so'm`,
          `📊 <b>Holat:</b> ${STATUS_LABELS[nextStatus]}`,
          `🕐 <b>Vaqt:</b> ${new Date(order.created_at).toLocaleString("uz-UZ")}`,
        ].filter(Boolean).join("\n");

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cb.message.chat.id,
            message_id: cb.message.message_id,
            text: updatedText,
            parse_mode: "HTML",
            reply_markup: buildKeyboard(orderId, nextStatus),
          }),
        });

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: cb.id, text: `Status: ${STATUS_LABELS[nextStatus]}` }),
        });
      }

      if (action === "cancel") {
        await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();

        const items = Array.isArray(order.items)
          ? order.items.map((i: any) => `  • ${i.name} x${i.quantity} — ${i.price?.toLocaleString()} so'm`).join("\n")
          : JSON.stringify(order.items);

        const cancelledText = [
          `🛍 <b>BUYURTMA #${order.id.slice(0, 8).toUpperCase()}</b>`,
          "",
          `👤 <b>Mijoz:</b> ${order.full_name}`,
          `📞 <b>Telefon:</b> ${order.phone}`,
          `📍 <b>Manzil:</b> ${order.address}`,
          order.note ? `📝 <b>Izoh:</b> ${order.note}` : null,
          "",
          `🧾 <b>Mahsulotlar:</b>`,
          items,
          "",
          `💰 <b>Jami:</b> ${Number(order.total).toLocaleString()} so'm`,
          `📊 <b>Holat:</b> ❌ Bekor qilingan`,
          `🕐 <b>Vaqt:</b> ${new Date(order.created_at).toLocaleString("uz-UZ")}`,
        ].filter(Boolean).join("\n");

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cb.message.chat.id,
            message_id: cb.message.message_id,
            text: cancelledText,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [] },
          }),
        });

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: cb.id, text: "Buyurtma bekor qilindi" }),
        });
      }

      return new Response("ok");
    }

    const { record } = body;
    if (!record) {
      console.log("No record in body");
      return new Response("no record", { status: 400 });
    }

    console.log("New order:", record.id);

    const items = Array.isArray(record.items)
      ? record.items.map((i: any) => `  • ${i.name} x${i.quantity} — ${i.price?.toLocaleString()} so'm`).join("\n")
      : JSON.stringify(record.items);

    const text = [
      `🆕 <b>YANGI BUYURTMA #${record.id.slice(0, 8).toUpperCase()}</b>`,
      "",
      `👤 <b>Mijoz:</b> ${record.full_name}`,
      `📞 <b>Telefon:</b> ${record.phone}`,
      `📍 <b>Manzil:</b> ${record.address}`,
      record.note ? `📝 <b>Izoh:</b> ${record.note}` : null,
      "",
      `🧾 <b>Mahsulotlar:</b>`,
      items,
      "",
      `💰 <b>Jami:</b> ${Number(record.total).toLocaleString()} so'm`,
      `📊 <b>Holat:</b> ${STATUS_LABELS[record.status] || record.status}`,
      `🕐 <b>Vaqt:</b> ${new Date(record.created_at).toLocaleString("uz-UZ")}`,
    ].filter(Boolean).join("\n");

    await sendTelegram(text, buildKeyboard(record.id, record.status));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", String(err));
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});