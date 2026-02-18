const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function processDeepDiveItem(itemId: string, authHeader: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Get the item
    const { data: item, error: fetchError } = await supabase
      .from('deep_dive_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchError || !item) {
      console.error('Item not found:', fetchError);
      return;
    }

    // Mark as processing
    await serviceClient
      .from('deep_dive_items')
      .update({ status: 'processing' })
      .eq('id', itemId);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      await serviceClient.from('deep_dive_items').update({
        status: 'error',
        error_message: 'AI niet geconfigureerd',
      }).eq('id', itemId);
      return;
    }

    let messages: any[];

    if (item.source_type === 'upload' && item.file_path) {
      // Download PDF as ArrayBuffer
      const { data: fileData, error: dlError } = await serviceClient.storage
        .from('deep-dive-docs')
        .download(item.file_path);

      if (dlError || !fileData) {
        await serviceClient.from('deep_dive_items').update({
          status: 'error',
          error_message: 'Bestand kon niet worden gedownload: ' + (dlError?.message || 'onbekende fout'),
        }).eq('id', itemId);
        return;
      }

      // Convert to base64 for Gemini PDF support
      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Pdf = btoa(binary);

      messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Je bent een ervaren financieel analist. Analyseer dit document en geef een gestructureerde samenvatting in het Nederlands:

## Samenvatting
Kernboodschap in 2-3 zinnen.

## Belangrijkste bevindingen
- Bullet points met de key takeaways

## Financiële indicatoren
- Relevante financiële cijfers en ratio's uit het document

## Risico's
- Geïdentificeerde risicofactoren

## Kansen
- Potentiële kansen en groeimogelijkheden

Houd het beknopt maar volledig (max 500 woorden).`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64Pdf}`,
              },
            },
          ],
        },
      ];
    } else {
      // For scraped content, use text directly
      const content = item.content_markdown || '';
      if (!content || content.length < 10) {
        await serviceClient.from('deep_dive_items').update({
          status: 'error',
          error_message: 'Geen leesbare content gevonden',
        }).eq('id', itemId);
        return;
      }

      messages = [
        {
          role: 'system',
          content: `Je bent een ervaren financieel analist. Analyseer het document en geef een gestructureerde samenvatting in het Nederlands:

## Samenvatting
Kernboodschap in 2-3 zinnen.

## Belangrijkste bevindingen
- Bullet points met de key takeaways

## Financiële indicatoren
- Relevante financiële cijfers en ratio's uit het document

## Risico's
- Geïdentificeerde risicofactoren

## Kansen
- Potentiële kansen en groeimogelijkheden

Houd het beknopt maar volledig (max 500 woorden).`,
        },
        { role: 'user', content: content.substring(0, 12000) },
      ];
    }

    // Call Gemini — it natively supports PDF reading via base64
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      let errorMsg = 'AI analyse mislukt';
      if (status === 429) errorMsg = 'Rate limit bereikt, probeer later opnieuw';
      if (status === 402) errorMsg = 'AI credits onvoldoende';

      const errBody = await aiResponse.text();
      console.error('AI error:', status, errBody);

      await serviceClient.from('deep_dive_items').update({
        status: 'error',
        error_message: errorMsg,
      }).eq('id', itemId);
      return;
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || '';

    await serviceClient.from('deep_dive_items').update({
      summary,
      status: 'done',
    }).eq('id', itemId);

    console.log('Deep dive analysis complete for item:', itemId);
  } catch (error) {
    console.error('Background processing error:', error);
    try {
      await serviceClient.from('deep_dive_items').update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Onbekende fout tijdens analyse',
      }).eq('id', itemId);
    } catch (updateErr) {
      console.error('Failed to update error status:', updateErr);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { item_id } = await req.json();
    if (!item_id) {
      return new Response(JSON.stringify({ error: 'item_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Return immediately — process in background to avoid timeout
    // @ts-ignore EdgeRuntime is available in Supabase edge functions
    EdgeRuntime.waitUntil(processDeepDiveItem(item_id, authHeader));

    return new Response(JSON.stringify({ success: true, message: 'Analyse gestart' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Deep dive analyze error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
