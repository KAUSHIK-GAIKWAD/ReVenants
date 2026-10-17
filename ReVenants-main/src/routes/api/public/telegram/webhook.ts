import { createFileRoute } from "@tanstack/react-router";
import { deriveWebhookSecret, handleTelegramUpdate } from "@/lib/coordinator.server";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = await deriveWebhookSecret();
        const actual = request.headers.get("X-Telegram-Bot-Api-Secret-Token");

        // Validate secret if provided by Telegram
        if (actual && actual !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = await request.json();
        try {
          await handleTelegramUpdate(update);
        } catch (e) {
          console.error("Telegram webhook error:", e);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
