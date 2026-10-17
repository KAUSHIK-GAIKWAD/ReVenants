import { createFileRoute } from "@tanstack/react-router";
import * as store from "@/lib/store";

export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: async () => {
        const tasks = await store.getTasks();
        const total = tasks.length;
        const counts = {
          complete: tasks.filter((t) => t.status === "Complete").length,
          in_progress: tasks.filter((t) => t.status === "In Progress").length,
          blocked: tasks.filter((t) => t.status === "Blocked").length,
          pending: tasks.filter((t) => t.status === "Pending").length,
        };
        const completion_pct = total > 0 ? Math.round((counts.complete / total) * 100) : 0;

        return Response.json({
          total,
          ...counts,
          completion_pct,
        });
      },
    },
  },
});
