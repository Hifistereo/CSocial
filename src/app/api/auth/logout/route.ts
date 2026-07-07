import { api, jsonClearSession } from "@/lib/api";

export const POST = api(async () => {
  return jsonClearSession({ ok: true });
});
