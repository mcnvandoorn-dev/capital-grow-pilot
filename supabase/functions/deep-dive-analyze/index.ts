const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader! } } }
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

    // Get the item
    const { data: item, error: fetchError } = await supabase
      .from('deep_dive_items')
      .select('*')
      .eq('id', item_id)
      .single();

    if (fetchError || !item) {
      return new Response(JSON.stringify({ error: 'Item not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // For uploaded files, download content from storage
    let content = item.content_markdown || '';

    if (item.source_type === 'upload' && item.file_path && !content) {
      // Use service role to read the file
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: fileData, error: dlError } = await serviceClient.storage
        .from('deep-dive-docs')
        .download(item.file_path);

      if (!dlError && fileData) {
        content = await fileData.text();
      }
    }

    if (!content || content.length < 10) {
      await supabase.from('deep_dive_items').update({
        status: 'error',
        error_message: 'Geen leesbare content gevonden',
      }).eq('id', item_id);

      return new Response(JSON.stringify({ error: 'No content to analyze' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update status to processing
    await supabase.from('deep_dive_items').update({ status: 'processing' }).eq('id', item_id);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const truncatedContent = content.substring(0, 12000);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
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

Houd het beknopt maar volledig (max 400 woorden).`
          },
          { role: 'user', content: truncatedContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      let errorMsg = 'AI analysis failed';
      if (status === 429) errorMsg = 'Rate limit bereikt, probeer later opnieuw';
      if (status === 402) errorMsg = 'AI credits onvoldoende';

      await supabase.from('deep_dive_items').update({
        status: 'error', error_message: errorMsg
      }).eq('id', item_id);

      return new Response(JSON.stringify({ error: errorMsg }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || '';

    await supabase.from('deep_dive_items').update({
      summary,
      content_markdown: content.substring(0, 50000),
      status: 'done',
    }).eq('id', item_id);

    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Deep dive analyze error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
