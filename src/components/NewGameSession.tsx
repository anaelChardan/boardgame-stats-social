import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Search, Plus, Minus, Trophy, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BoardGame {
  id: number;
  name: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  image?: string;
}

interface Player {
  id: string;
  name: string;
  score: number;
  position: number;
  isWinner: boolean;
  isUser?: boolean; // Track if this player represents the logged-in user
}

const NewGameSession = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BoardGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<BoardGame | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: '', score: 0, position: 1, isWinner: false }
  ]);
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState('');

  const mockGames: BoardGame[] = [
    {
      id: 167791,
      name: "Terraforming Mars",
      yearPublished: 2016,
      minPlayers: 1,
      maxPlayers: 5,
      playingTime: 120
    },
    {
      id: 224517,
      name: "Brass: Birmingham", 
      yearPublished: 2018,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 180
    },
    {
      id: 161936,
      name: "Pandemic Legacy: Season 1",
      yearPublished: 2015,
      minPlayers: 2,
      maxPlayers: 4,
      playingTime: 60
    },
    {
      id: 174430,
      name: "Gloomhaven",
      yearPublished: 2017,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 120
    },
    {
      id: 12333,
      name: "Twilight Struggle",
      yearPublished: 2005,
      minPlayers: 2,
      maxPlayers: 2,
      playingTime: 180
    },
    {
      id: 9209,
      name: "Ticket to Ride",
      yearPublished: 2004,
      minPlayers: 2,
      maxPlayers: 5,
      playingTime: 60
    },
    {
      id: 13,
      name: "Catan",
      yearPublished: 1995,
      minPlayers: 3,
      maxPlayers: 4,
      playingTime: 75
    },
    {
      id: 220308,
      name: "Gaia Project",
      yearPublished: 2017,
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 150
    }
  ];

  const searchBoardGames = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowAutocomplete(false);
      return;
    }
    
    setIsSearching(true);
    try {
      console.log(`Searching for: ${query}`);
      
      // Call our edge function to search BGG API
      const { data, error } = await supabase.functions.invoke('bgg-search', {
        body: { query: query.trim() }
      });

      if (error) {
        console.error('BGG search error:', error);
        throw new Error(error.message || 'Erreur de recherche BGG');
      }

      if (!data || !data.games) {
        console.error('Invalid response from BGG search:', data);
        throw new Error('Réponse invalide du serveur');
      }

      console.log(`Found ${data.games.length} games from BGG`);
      
      // Convert BGG response to our format
      const bggGames: BoardGame[] = data.games.map((game: any) => ({
        id: game.id,
        name: game.name,
        yearPublished: game.yearPublished,
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        playingTime: game.playingTime,
        image: game.image,
        internalId: game.internalId,
      }));
      
      setSearchResults(bggGames);
      setShowAutocomplete(true);
      
    } catch (error: any) {
      console.error('Search error:', error);
      
      // Fallback to mock games if BGG fails
      console.log('Falling back to mock games due to error:', error.message);
      const filteredGames = mockGames.filter(game => 
        game.name.toLowerCase().includes(query.toLowerCase())
      );
      
      setSearchResults(filteredGames);
      setShowAutocomplete(true);
      
      toast({
        title: "Recherche BGG échouée",
        description: `Utilisation des jeux de test. Erreur: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Handle input changes with real-time search
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    
    // Debounce the search to avoid too many API calls
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      searchBoardGames(value);
    }, 500);
    
    setSearchTimeout(timeout);
  };

  // Handle clicking outside to close autocomplete
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowAutocomplete(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Cleanup timeout on unmount
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const selectGame = async (game: BoardGame) => {
    setSelectedGame(game);
    setSearchResults([]);
    setShowAutocomplete(false);
    setSearchTerm('');
    
    // For the demo, just use the game data we already have
    // In a real implementation, you'd fetch more details from BGG API via edge function
    toast({
      title: "Jeu sélectionné",
      description: `${game.name} ajouté à votre partie`,
    });
  };

  const addPlayer = () => {
    const newPlayer: Player = {
      id: Date.now().toString(),
      name: '',
      score: 0,
      position: players.length + 1,
      isWinner: false
    };
    setPlayers([...players, newPlayer]);
  };

  const removePlayer = (playerId: string) => {
    if (players.length > 1) {
      setPlayers(players.filter(p => p.id !== playerId));
    }
  };

  const updatePlayer = (playerId: string, field: keyof Player, value: any) => {
    setPlayers(players.map(p => 
      p.id === playerId ? { ...p, [field]: value } : p
    ));
  };

  const calculatePositions = () => {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const updated = players.map(player => {
      const position = sorted.findIndex(p => p.id === player.id) + 1;
      const isWinner = position === 1;
      return { ...player, position, isWinner };
    });
    setPlayers(updated);
  };

  const saveGameSession = async () => {
    if (!selectedGame || !user) return;
    
    const validPlayers = players.filter(p => p.name.trim());
    if (validPlayers.length === 0) {
      toast({
        title: "Erreur",
        description: "Ajoutez au moins un joueur",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // First, save or get the game
      let gameId: string;
      
      // Check if we have an internal ID from BGG search
      if ((selectedGame as any).internalId) {
        gameId = (selectedGame as any).internalId;
        console.log(`Using existing game ID: ${gameId}`);
      } else {
        // Fallback: check if game exists by BGG ID
        const { data: existingGame } = await supabase
          .from('games')
          .select('id')
          .eq('bgg_id', selectedGame.id)
          .single();

        if (existingGame) {
          gameId = existingGame.id;
          console.log(`Found existing game by BGG ID: ${gameId}`);
        } else {
          // Create new game (fallback for mock games)
          const { data: newGame, error: gameError } = await supabase
            .from('games')
            .insert({
              bgg_id: selectedGame.id,
              name: selectedGame.name,
              min_players: selectedGame.minPlayers,
              max_players: selectedGame.maxPlayers,
              playing_time: selectedGame.playingTime,
              image_url: selectedGame.image,
              year_published: selectedGame.yearPublished,
            })
            .select('id')
            .single();

          if (gameError) throw gameError;
          gameId = newGame.id;
          console.log(`Created new game: ${gameId}`);
        }
      }

      // Create the game session
      const { data: session, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          user_id: user.id,
          game_id: gameId,
          duration_minutes: duration,
          notes: notes.trim() || null,
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;

      // Add players to the session
      const playerInserts = validPlayers.map(player => ({
        session_id: session.id,
        player_name: player.name,
        score: player.score,
        position: player.position,
        is_winner: player.isWinner,
        is_session_owner: player.isUser || false,
      }));

      const { error: playersError } = await supabase
        .from('game_session_players')
        .insert(playerInserts);

      if (playersError) throw playersError;

      toast({
        title: "Partie enregistrée !",
        description: `Votre partie de ${selectedGame.name} a été sauvegardée`,
      });

      onClose();
    } catch (error: any) {
      console.error('Error saving game session:', error);
      toast({
        title: "Erreur",
        description: error?.message || "Impossible d'enregistrer la partie",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {!selectedGame ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search size={24} />
              <span>Rechercher un jeu</span>
            </CardTitle>
            <CardDescription>
              Trouvez votre jeu dans la base de données BoardGameGeek
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative" ref={searchRef}>
              <div className="flex items-center space-x-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Tapez pour rechercher un jeu..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => searchTerm && setShowAutocomplete(true)}
                  className="pl-10"
                />
              </div>

              {showAutocomplete && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1">
                  <Command className="rounded-lg border shadow-md bg-popover">
                    <CommandList className="max-h-60">
                      <CommandGroup>
                        {searchResults.map((game) => (
                          <CommandItem
                            key={game.id}
                            value={game.name}
                            onSelect={() => selectGame(game)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex flex-col">
                                <span className="font-medium">{game.name}</span>
                                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                  {game.yearPublished && (
                                    <span>({game.yearPublished})</span>
                                  )}
                                  {game.minPlayers && game.maxPlayers && (
                                    <span>
                                      <Users size={12} className="inline mr-1" />
                                      {game.minPlayers}-{game.maxPlayers}
                                    </span>
                                  )}
                                  {game.playingTime && (
                                    <span>{game.playingTime}min</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      {searchResults.length === 0 && searchTerm && (
                        <CommandEmpty>
                          Aucun jeu trouvé. Essayez "Terraforming", "Brass", "Pandemic", "Gloomhaven", ou "Twilight".
                        </CommandEmpty>
                      )}
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Selected game info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{selectedGame.name}</span>
                <Button variant="outline" onClick={() => setSelectedGame(null)}>
                  Changer de jeu
                </Button>
              </CardTitle>
              <CardDescription className="flex flex-wrap gap-2">
                {selectedGame.yearPublished && (
                  <Badge variant="secondary">{selectedGame.yearPublished}</Badge>
                )}
                {selectedGame.minPlayers && selectedGame.maxPlayers && (
                  <Badge variant="secondary">
                    <Users size={14} className="mr-1" />
                    {selectedGame.minPlayers}-{selectedGame.maxPlayers} joueurs
                  </Badge>
                )}
                {selectedGame.playingTime && (
                  <Badge variant="secondary">{selectedGame.playingTime} min</Badge>
                )}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Players */}
          <Card>
            <CardHeader>
              <CardTitle>Joueurs et scores</CardTitle>
              <CardDescription>
                Ajoutez les joueurs et leurs scores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {players.map((player, index) => (
                <div key={player.id} className="flex items-center space-x-2">
                  <Input
                    placeholder={`Joueur ${index + 1}`}
                    value={player.name}
                    onChange={(e) => updatePlayer(player.id, 'name', e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Score"
                    value={player.score || ''}
                    onChange={(e) => updatePlayer(player.id, 'score', parseInt(e.target.value) || 0)}
                    className="w-24"
                  />
                  <label className="flex items-center space-x-1 text-sm">
                    <input
                      type="checkbox"
                      checked={player.isUser || false}
                      onChange={(e) => {
                        // Only one player can be the user
                        if (e.target.checked) {
                          // Uncheck all other players first
                          setPlayers(players.map(p => ({ ...p, isUser: false })));
                        }
                        updatePlayer(player.id, 'isUser', e.target.checked);
                      }}
                      className="rounded"
                    />
                    <span>C'est moi</span>
                  </label>
                  {player.isWinner && (
                    <Trophy size={20} className="text-yellow-500" />
                  )}
                  {players.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removePlayer(player.id)}
                    >
                      <Minus size={16} />
                    </Button>
                  )}
                </div>
              ))}
              
              <div className="flex space-x-2">
                <Button variant="outline" onClick={addPlayer}>
                  <Plus size={16} className="mr-2" />
                  Ajouter un joueur
                </Button>
                <Button variant="outline" onClick={calculatePositions}>
                  Calculer les positions
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Game details */}
          <Card>
            <CardHeader>
              <CardTitle>Détails de la partie</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="duration">Durée (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                  min="1"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Textarea
                  id="notes"
                  placeholder="Commentaires sur la partie..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save button */}
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={saveGameSession} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer la partie'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewGameSession;