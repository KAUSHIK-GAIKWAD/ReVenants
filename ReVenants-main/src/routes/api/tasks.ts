import { createFileRoute } from "@tanstack/react-router";
import * as store from "@/lib/store";

export const Route = createFileRoute("/api/tasks")({
  server: {
    handlers: {
      GET: async () => {
        const tasks = await store.getTasks();
        return Response.json(tasks);
      },
    },
  },
});
