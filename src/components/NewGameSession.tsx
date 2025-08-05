import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
}

const NewGameSession = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<BoardGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<BoardGame | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: '', score: 0, position: 1, isWinner: false }
  ]);
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState('');

  const searchBoardGames = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      // Create a simple mock search for now since CORS proxy isn't working
      // In a real app, you'd implement this via an edge function
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
        }
      ];
      
      // Filter games based on search query
      const filteredGames = mockGames.filter(game => 
        game.name.toLowerCase().includes(query.toLowerCase())
      );
      
      setSearchResults(filteredGames);
      
      // Show a note about the temporary search
      if (filteredGames.length === 0) {
        toast({
          title: "Recherche temporaire",
          description: "Recherche limitée pour la démo. Essayez 'Terraforming', 'Brass', 'Pandemic', 'Gloomhaven', ou 'Twilight'",
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Erreur de recherche",
        description: "Impossible de rechercher les jeux pour le moment",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const selectGame = async (game: BoardGame) => {
    setSelectedGame(game);
    setSearchResults([]);
    
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
      const { data: existingGame } = await supabase
        .from('games')
        .select('id')
        .eq('bgg_id', selectedGame.id)
        .single();

      if (existingGame) {
        gameId = existingGame.id;
      } else {
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
            <div className="flex space-x-2">
              <Input
                placeholder="Nom du jeu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchBoardGames(searchTerm)}
              />
              <Button 
                onClick={() => searchBoardGames(searchTerm)}
                disabled={isSearching || !searchTerm.trim()}
              >
                {isSearching ? 'Recherche...' : 'Rechercher'}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Résultats de recherche :</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((game) => (
                    <Card key={game.id} className="cursor-pointer hover:bg-muted" onClick={() => selectGame(game)}>
                      <CardContent className="p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">{game.name}</h4>
                            {game.yearPublished && (
                              <p className="text-sm text-muted-foreground">({game.yearPublished})</p>
                            )}
                          </div>
                          <Button size="sm" variant="outline">
                            Sélectionner
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
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