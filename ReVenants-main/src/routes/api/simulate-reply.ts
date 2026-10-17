import { createFileRoute } from "@tanstack/react-router";
import { processReply } from "@/lib/coordinator.server";

export const Route = createFileRoute("/api/simulate-reply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const taskId = body.task_id || body.taskId;
          const reply = body.reply;

          if (!taskId || !reply) {
            return Response.json(
              { error: "task_id and reply fields are required" },
              { status: 400 },
            );
          }

          const result = await processReply(taskId, reply, "simulation", "Simulation");
          return Response.json({
            task_id: result.task_id,
            previous_status: result.previous_status,
            new_status: result.new_status,
            updated: result.updated,
            reply_text: result.reply_text,
            classification: result.classification,
          });
        } catch (e) {
          console.error("simulate-reply error", e);
          return Response.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
