import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function getGoogleAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const headerB64 = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const claimsB64 = btoa(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const signingInput = `${headerB64}.${claimsB64}`;

  // Robustly clean the PEM key regardless of how it was pasted into Supabase secrets
  const pemBody = privateKeyPem
    .replace(/\\n/g, "\n")                          // literal \n → real newline
    .replace(/\\r/g, "")                            // remove literal \r
    .replace(/^["']|["']$/g, "")                   // strip surrounding quotes if any
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "")                            // remove all whitespace/newlines
    .replace(/[^A-Za-z0-9+/=]/g, "");              // strip any remaining non-base64 chars

  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const jwt = `${signingInput}.${signatureB64}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    throw new Error(`Failed to get Google access token: ${err}`);
  }

  const { access_token } = await tokenResp.json();
  return access_token;
}

async function sendFCMNotification(
  accessToken: string,
  projectId: string,
  fcmToken: string,
  title: string,
  body: string
): Promise<void> {
  const resp = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          webpush: {
            notification: {
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              requireInteraction: false,
            },
          },
        },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    console.error(`FCM send failed for token ${fcmToken.slice(0, 20)}...: ${err}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const firebaseClientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
    const firebasePrivateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");
    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const canSendPush = !!(firebaseClientEmail && firebasePrivateKey && firebaseProjectId);

    const now = new Date();
    const todayDate = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().slice(0, 5);

    const entriesResp = await fetch(
      `${supabaseUrl}/rest/v1/journal_entries?select=id,user_id,title,content,reminder_date,reminder_time&reminder_enabled=eq.true&reminder_sent=eq.false&reminder_date=lte.${todayDate}`,
      {
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
        },
      }
    );

    if (!entriesResp.ok) throw new Error(`Failed to fetch reminders: ${entriesResp.statusText}`);

    const entries = await entriesResp.json();

    const dueEntries = entries.filter((e: any) => {
      if (!e.reminder_date || !e.reminder_time) return false;
      const reminderAt = new Date(`${e.reminder_date}T${e.reminder_time}`);
      return reminderAt <= now;
    });

    if (dueEntries.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No due reminders" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let accessToken: string | null = null;
    if (canSendPush) {
      const privateKey = firebasePrivateKey!.replace(/\\n/g, "\n");
      accessToken = await getGoogleAccessToken(firebaseClientEmail!, privateKey);
    }

    let sentCount = 0;
    const sentIds: string[] = [];

    for (const entry of dueEntries) {
      sentIds.push(entry.id);

      if (canSendPush && accessToken && entry.user_id) {
        const tokenResp = await fetch(
          `${supabaseUrl}/rest/v1/user_fcm_tokens?user_id=eq.${entry.user_id}&select=token`,
          {
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
            },
          }
        );

        if (tokenResp.ok) {
          const tokenRows = await tokenResp.json();
          for (const row of tokenRows) {
            if (row.token) {
              await sendFCMNotification(
                accessToken,
                firebaseProjectId!,
                row.token,
                `Reminder: ${entry.title}`,
                entry.content || "Journal reminder"
              );
              sentCount++;
            }
          }
        }
      }
    }

    const ids = sentIds.join(",");
    await fetch(
      `${supabaseUrl}/rest/v1/journal_entries?id=in.(${ids})`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          apikey: supabaseKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ reminder_sent: true }),
      }
    );

    return new Response(
      JSON.stringify({ sent: sentCount, processed: sentIds.length, pushEnabled: canSendPush }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-reminders:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
