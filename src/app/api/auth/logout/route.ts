import { clearSessionResponse } from "@/lib/server-auth";

export async function POST() {
  return clearSessionResponse();
}
