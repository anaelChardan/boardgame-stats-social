import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BoardGame {
  id: number;
  name: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  image?: string;
  description?: string;
}

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

function parseXML(xmlString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

function extractTextContent(element: Element | null): string {
  return element?.textContent?.trim() || '';
}

function extractNumberContent(element: Element | null): number | undefined {
  const text = extractTextContent(element);
  const num = parseInt(text);
  return isNaN(num) ? undefined : num;
}

async function searchBGG(query: string): Promise<BoardGame[]> {
  console.log(`Searching BGG for: ${query}`);
  
  try {
    // Step 1: Search for games
    const searchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame`;
    console.log(`Search URL: ${searchUrl}`);
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`BGG search failed: ${searchResponse.status}`);
    }
    
    const searchXml = await searchResponse.text();
    const searchDoc = parseXML(searchXml);
    
    // Extract game IDs from search results
    const items = searchDoc.querySelectorAll('item');
    const gameIds: number[] = [];
    
    for (const item of items) {
      const id = item.getAttribute('id');
      if (id && gameIds.length < 10) { // Limit to 10 results
        gameIds.push(parseInt(id));
      }
    }
    
    if (gameIds.length === 0) {
      console.log('No games found in search');
      return [];
    }
    
    // Step 2: Get detailed information for each game
    const detailsUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${gameIds.join(',')}&stats=1`;
    console.log(`Details URL: ${detailsUrl}`);
    
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) {
      throw new Error(`BGG details failed: ${detailsResponse.status}`);
    }
    
    const detailsXml = await detailsResponse.text();
    const detailsDoc = parseXML(detailsXml);
    
    // Parse game details
    const games: BoardGame[] = [];
    const gameItems = detailsDoc.querySelectorAll('item[type="boardgame"]');
    
    for (const item of gameItems) {
      const id = parseInt(item.getAttribute('id') || '0');
      if (!id) continue;
      
      // Get primary name
      const primaryName = item.querySelector('name[type="primary"]')?.getAttribute('value') || '';
      
      // Get year published
      const yearElement = item.querySelector('yearpublished');
      const yearPublished = extractNumberContent(yearElement);
      
      // Get player count
      const minPlayersElement = item.querySelector('minplayers');
      const maxPlayersElement = item.querySelector('maxplayers');
      const minPlayers = extractNumberContent(minPlayersElement);
      const maxPlayers = extractNumberContent(maxPlayersElement);
      
      // Get playing time
      const playingTimeElement = item.querySelector('playingtime');
      const playingTime = extractNumberContent(playingTimeElement);
      
      // Get image
      const imageElement = item.querySelector('image');
      const image = extractTextContent(imageElement);
      
      // Get description
      const descriptionElement = item.querySelector('description');
      const description = extractTextContent(descriptionElement);
      
      if (primaryName) {
        games.push({
          id,
          name: primaryName,
          yearPublished,
          minPlayers,
          maxPlayers,
          playingTime,
          image: image || undefined,
          description: description || undefined,
        });
      }
    }
    
    console.log(`Found ${games.length} games`);
    return games;
    
  } catch (error) {
    console.error('BGG API error:', error);
    throw error;
  }
}

async function getOrCreateGame(gameData: BoardGame) {
  try {
    // Check if game already exists
    const { data: existingGame, error: searchError } = await supabase
      .from('games')
      .select('id')
      .eq('bgg_id', gameData.id)
      .single();
    
    if (searchError && searchError.code !== 'PGRST116') {
      throw searchError;
    }
    
    if (existingGame) {
      console.log(`Game ${gameData.name} already exists with id ${existingGame.id}`);
      return existingGame.id;
    }
    
    // Create new game
    const { data: newGame, error: insertError } = await supabase
      .from('games')
      .insert({
        bgg_id: gameData.id,
        name: gameData.name,
        year_published: gameData.yearPublished,
        min_players: gameData.minPlayers,
        max_players: gameData.maxPlayers,
        playing_time: gameData.playingTime,
        image_url: gameData.image,
        description: gameData.description,
      })
      .select('id')
      .single();
    
    if (insertError) {
      throw insertError;
    }
    
    console.log(`Created new game ${gameData.name} with id ${newGame.id}`);
    return newGame.id;
    
  } catch (error) {
    console.error(`Error storing game ${gameData.name}:`, error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required and must be a string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing search request for: ${query}`);
    
    // Search BGG and get game details
    const games = await searchBGG(query);
    
    // Store games in database and return with internal IDs
    const gamesWithIds = await Promise.all(
      games.map(async (game) => {
        try {
          const internalId = await getOrCreateGame(game);
          return {
            ...game,
            internalId,
          };
        } catch (error) {
          console.error(`Failed to store game ${game.name}:`, error);
          return {
            ...game,
            internalId: null,
          };
        }
      })
    );
    
    return new Response(
      JSON.stringify({ games: gamesWithIds }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});