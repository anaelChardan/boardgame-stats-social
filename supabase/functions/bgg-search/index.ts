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

// Simple XML parser for Deno environment using regex
function parseSearchXML(xmlString: string): { id: number; name: string }[] {
  const games: { id: number; name: string }[] = [];
  const itemMatches = xmlString.match(/<item[^>]*>[\s\S]*?<\/item>/g);
  
  if (itemMatches) {
    itemMatches.forEach(itemXml => {
      const idMatch = itemXml.match(/id="(\d+)"/);
      const nameMatch = itemXml.match(/<name[^>]*value="([^"]*)"[^>]*\/>/);
      
      if (idMatch && nameMatch) {
        games.push({
          id: parseInt(idMatch[1]),
          name: nameMatch[1]
        });
      }
    });
  }
  
  return games;
}

function parseDetailsXML(xmlString: string): BoardGame[] {
  const games: BoardGame[] = [];
  const itemMatches = xmlString.match(/<item[^>]*type="boardgame"[^>]*>[\s\S]*?<\/item>/g);
  
  if (itemMatches) {
    itemMatches.forEach(itemXml => {
      const idMatch = itemXml.match(/id="(\d+)"/);
      const nameMatch = itemXml.match(/<name[^>]*type="primary"[^>]*value="([^"]*)"[^>]*\/>/);
      const yearMatch = itemXml.match(/<yearpublished[^>]*value="([^"]*)"[^>]*\/>/);
      const minPlayersMatch = itemXml.match(/<minplayers[^>]*value="([^"]*)"[^>]*\/>/);
      const maxPlayersMatch = itemXml.match(/<maxplayers[^>]*value="([^"]*)"[^>]*\/>/);
      const playingTimeMatch = itemXml.match(/<playingtime[^>]*value="([^"]*)"[^>]*\/>/);
      const imageMatch = itemXml.match(/<image>(.*?)<\/image>/);
      const descriptionMatch = itemXml.match(/<description>(.*?)<\/description>/);
      
      if (idMatch && nameMatch) {
        games.push({
          id: parseInt(idMatch[1]),
          name: nameMatch[1],
          yearPublished: yearMatch ? parseInt(yearMatch[1]) : undefined,
          minPlayers: minPlayersMatch ? parseInt(minPlayersMatch[1]) : undefined,
          maxPlayers: maxPlayersMatch ? parseInt(maxPlayersMatch[1]) : undefined,
          playingTime: playingTimeMatch ? parseInt(playingTimeMatch[1]) : undefined,
          image: imageMatch ? imageMatch[1] : undefined,
          description: descriptionMatch ? descriptionMatch[1] : undefined,
        });
      }
    });
  }
  
  return games;
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
    const searchResults = parseSearchXML(searchXml);
    
    if (searchResults.length === 0) {
      console.log('No games found in search');
      return [];
    }
    
    // Limit to first 10 results
    const gameIds = searchResults.slice(0, 10).map(game => game.id);
    
    // Step 2: Get detailed information for each game
    const detailsUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${gameIds.join(',')}&stats=1`;
    console.log(`Details URL: ${detailsUrl}`);
    
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) {
      throw new Error(`BGG details failed: ${detailsResponse.status}`);
    }
    
    const detailsXml = await detailsResponse.text();
    const games = parseDetailsXML(detailsXml);
    
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