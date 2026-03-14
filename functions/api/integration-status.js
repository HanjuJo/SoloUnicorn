import { jsonResponse } from "../_lib/gemini.js";
import { getIntegrationStatus } from "../_lib/integrations.js";

export async function onRequestGet(context) {
  return jsonResponse({
    integrations: getIntegrationStatus(context.env),
  });
}
