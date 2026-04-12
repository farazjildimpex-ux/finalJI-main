import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, title, message, sendAfter, appId } = await req.json();
    
    // 1. Get and clean the API Key
    const rawApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY") || "";
    const apiKey = rawApiKey.trim();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ONESIGNAL_REST_API_KEY is missing in Supabase Secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Diagnostic: Log the first 5 chars of the key to Supabase logs (safe)
    console.log(`Attempting notification for App: ${appId}`);
    console.log(`Using API Key starting with: ${apiKey.substring(0, 8)}...`);

    // 2. Prepare the payload
    // OneSignal sometimes prefers app_id to be the first property
    const payload = {
      app_id: appId,
      include_external_user_ids: [userId],
      headings: { en: title },
      contents: { en: message },
      target_channel: "push",
    };

    if (sendAfter) {
      // @ts-ignore
      payload.send_after = new Date(sendAfter * 1000).toUTCString();
    }

    // 3. Call OneSignal API
    const osResponse = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const osData = await osResponse.json();
    
    if (!osResponse.ok) {
      console.error("OneSignal API Error:", osData);
      return new Response(
        JSON.stringify({ 
          error: "OneSignal rejected the request", 
          details: osData.errors?.[0] || "Check if REST API Key matches the App ID",
          status: osResponse.status,
          osResponse: osData
        }),
        { status: osResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("OneSignal Success:", osData);
    return new Response(JSON.stringify(osData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Proxy Function Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});