import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5";

const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "{}");
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

let cached: { token: string; exp: number } | null = null;

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp > now + 60) return cached.token;
  const key = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email).setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now).setExpirationTime(now + 3600).sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const j = await res.json();
  cached = { token: j.access_token, exp: now + 3500 };
  return cached.token;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const n = payload.record;
    if (!n?.user_id) return new Response("skip");
    if (!sa.private_key) return new Response("FCM_SERVICE_ACCOUNT belum diisi", { status: 500 });

    const { data: tokens } = await supabase.from("device_tokens").select("token").eq("user_id", n.user_id);
    if (!tokens?.length) return new Response("no token");

    const access = await accessToken();
    const results = await Promise.all(tokens.map(async (t: { token: string }) => {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: t.token,
            notification: { title: n.title, body: n.body ?? "" },
            data: { id: String(n.id), link: n.link ?? "" },
            android: { priority: "HIGH", notification: { channel_id: "kopra_default", sound: "default" } },
            apns: { payload: { aps: { sound: "default" } } },
          },
        }),
      });
      if (r.status === 404 || r.status === 400) {
        await supabase.from("device_tokens").delete().eq("token", t.token);
      }
      return r.status;
    }));
    return new Response(JSON.stringify(results));
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});