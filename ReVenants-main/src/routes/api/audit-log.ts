import { createFileRoute } from "@tanstack/react-router";
import * as store from "@/lib/store";

export const Route = createFileRoute("/api/audit-log")({
  server: {
    handlers: {
      GET: async () => {
        const history = await store.getStatusHistory(50);
        return Response.json(history);
      },
    },
  },
});
