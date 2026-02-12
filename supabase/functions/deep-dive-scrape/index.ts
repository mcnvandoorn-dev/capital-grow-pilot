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

    const { security_id, ticker, query } = await req.json();
    if (!security_id || !ticker) {
      return new Response(JSON.stringify({ error: 'security_id and ticker required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Firecrawl not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Search for relevant financial content
    const searchQuery = query || `${ticker} stock analysis financial deep dive`;
    console.log('Searching:', searchQuery);

    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
        scrapeOptions: { formats: ['markdown'] },
      }),
    });

    const searchData = await searchResponse.json();
    if (!searchResponse.ok) {
      console.error('Firecrawl search error:', searchData);
      return new Response(JSON.stringify({ error: searchData.error || 'Search failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = searchData.data || [];
    
    // Store each result as a deep_dive_item
    const items = [];
    for (const result of results) {
      const { data: item, error: insertError } = await supabase
        .from('deep_dive_items')
        .insert({
          security_id,
          user_id: user.id,
          source_type: 'scrape',
          title: result.title || result.url || 'Untitled',
          url: result.url,
          content_markdown: result.markdown || result.description || '',
          status: 'done',
        })
        .select()
        .single();

      if (!insertError && item) items.push(item);
    }

    // Now summarize each item using AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (LOVABLE_API_KEY && items.length > 0) {
      for (const item of items) {
        if (!item.content_markdown || item.content_markdown.length < 50) continue;
        
        try {
          const truncatedContent = item.content_markdown.substring(0, 8000);
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                { role: 'system', content: 'Je bent een financieel analist. Geef een beknopte samenvatting in het Nederlands van het volgende artikel. Focus op: kernpunten, financiële indicatoren, risico\'s en kansen. Max 200 woorden.' },
                { role: 'user', content: truncatedContent },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const summary = aiData.choices?.[0]?.message?.content;
            if (summary) {
              await supabase
                .from('deep_dive_items')
                .update({ summary })
                .eq('id', item.id);
              item.summary = summary;
            }
          }
        } catch (e) {
          console.error('AI summary error for item:', item.id, e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Deep dive scrape error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
