import type { ParsedIntent } from "./intent-schema";

/** Client helper: turn free text into rules via /api/intent. */
export async function requestIntent(message: string): Promise<ParsedIntent> {
  const response = await fetch("/api/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not read your request");
  return data as ParsedIntent;
}
