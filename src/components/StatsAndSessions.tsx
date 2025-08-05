import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trophy, Target, Users, Clock, TrendingUp, Calendar, Edit2, Trash2, MessageCircle, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface GameSession {
  id: string;
  played_at: string;
  duration_minutes: number;
  notes: string | null;
  game: {
    name: string;
    image_url: string | null;
  };
  players: Array<{
    id: string;
    player_name: string;
    score: number;
    position: number;
    is_winner: boolean;
    is_session_owner: boolean;
  }>;
  comments?: Array<{
    id: string;
    content: string;
    created_at: string;
    user_id: string;
  }>;
}

interface GameStats {
  name: string;
  total_sessions: number;
  wins: number;
  win_rate: number;
  avg_score: number;
  last_played: string;
}

const StatsAndSessions = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [gameStats, setGameStats] = useState<GameStats[]>([]);
  const [totalStats, setTotalStats] = useState({
    total_sessions: 0,
    total_wins: 0,
    total_games: 0,
    avg_duration: 0,
    win_rate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [editingSession, setEditingSession] = useState<GameSession | null>(null);
  const [commentingSession, setCommentingSession] = useState<GameSession | null>(null);
  const [newComment, setNewComment] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDuration, setEditDuration] = useState(0);
  const [editPlayers, setEditPlayers] = useState<Array<{
    id: string;
    player_name: string;
    score: number;
    position: number;
    is_winner: boolean;
    is_session_owner: boolean;
  }>>([]);

  useEffect(() => {
    if (user) {
      loadUserSessions();
      loadUserStats();
    }
  }, [user]);

  const loadUserSessions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('game_sessions')
        .select(`
          id,
          played_at,
          duration_minutes,
          notes,
          game:games(name, image_url),
          players:game_session_players(id, player_name, score, position, is_winner, is_session_owner),
          comments:comments(id, content, created_at, user_id)
        `)
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSessions((data as any) || []);
    } catch (error: any) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadUserStats = async () => {
    if (!user) return;

    try {
      // Get all user sessions with games and players
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('game_sessions')
        .select(`
          id,
          duration_minutes,
          game:games(name),
          players:game_session_players(player_name, score, position, is_winner, is_session_owner)
        `)
        .eq('user_id', user.id);

      if (sessionsError) throw sessionsError;

      const sessions = sessionsData as any[] || [];
      
      // Calculate total stats
      const totalSessions = sessions.length;
      const totalWins = sessions.reduce((wins, session) => {
        // Find the session owner (the user) and check if they won
        const userPlayer = session.players?.find((p: any) => p.is_session_owner);
        return wins + (userPlayer?.is_winner ? 1 : 0);
      }, 0);
      
      const avgDuration = sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / sessions.length 
        : 0;

      const uniqueGames = new Set(sessions.map(s => s.game?.name)).size;
      const winRate = totalSessions > 0 ? (totalWins / totalSessions) * 100 : 0;

      setTotalStats({
        total_sessions: totalSessions,
        total_wins: totalWins,
        total_games: uniqueGames,
        avg_duration: Math.round(avgDuration),
        win_rate: Math.round(winRate)
      });

      // Calculate per-game stats
      const gameStatsMap = new Map<string, any>();
      
      sessions.forEach(session => {
        const gameName = session.game?.name;
        if (!gameName) return;

        if (!gameStatsMap.has(gameName)) {
          gameStatsMap.set(gameName, {
            name: gameName,
            total_sessions: 0,
            wins: 0,
            total_score: 0,
            last_played: session.played_at || new Date().toISOString()
          });
        }

        const gameData = gameStatsMap.get(gameName);
        gameData.total_sessions++;
        
        // Find the session owner (the user) to get their stats
        const userPlayer = session.players?.find((p: any) => p.is_session_owner);
        if (userPlayer?.is_winner) {
          gameData.wins++;
          gameData.total_score += userPlayer.score || 0;
        }
      });

      const gameStatsList = Array.from(gameStatsMap.values()).map(game => ({
        ...game,
        win_rate: Math.round((game.wins / game.total_sessions) * 100),
        avg_score: game.wins > 0 ? Math.round(game.total_score / game.wins) : 0
      })).sort((a, b) => b.total_sessions - a.total_sessions);

      setGameStats(gameStatsList);
    } catch (error: any) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('game_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Partie supprimée",
        description: "La partie a été supprimée avec succès",
      });

      // Refresh data
      loadUserSessions();
      loadUserStats();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la partie",
        variant: "destructive",
      });
    }
  };

  const startEditSession = (session: GameSession) => {
    setEditingSession(session);
    setEditNotes(session.notes || '');
    setEditDuration(session.duration_minutes);
    setEditPlayers([...session.players]);
  };

  const updateEditPlayer = (playerId: string, field: 'score' | 'player_name', value: any) => {
    const updatedPlayers = editPlayers.map(p => 
      p.id === playerId ? { ...p, [field]: value } : p
    );
    
    // Auto-calculate positions when score changes
    if (field === 'score') {
      const sorted = [...updatedPlayers].sort((a, b) => b.score - a.score);
      const withPositions = updatedPlayers.map(player => {
        const position = sorted.findIndex(p => p.id === player.id) + 1;
        const isWinner = position === 1;
        return { ...player, position, is_winner: isWinner };
      });
      setEditPlayers(withPositions);
    } else {
      setEditPlayers(updatedPlayers);
    }
  };

  const calculateEditPositions = () => {
    const sorted = [...editPlayers].sort((a, b) => b.score - a.score);
    const updated = editPlayers.map(player => {
      const position = sorted.findIndex(p => p.id === player.id) + 1;
      const isWinner = position === 1;
      return { ...player, position, is_winner: isWinner };
    });
    setEditPlayers(updated);
  };

  const saveEditSession = async () => {
    if (!editingSession) return;

    try {
      // Update session details
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({
          notes: editNotes.trim() || null,
          duration_minutes: editDuration,
        })
        .eq('id', editingSession.id);

      if (sessionError) throw sessionError;

      // Update players
      for (const player of editPlayers) {
        const { error: playerError } = await supabase
          .from('game_session_players')
          .update({
            player_name: player.player_name,
            score: player.score,
            position: player.position,
            is_winner: player.is_winner,
          })
          .eq('id', player.id);

        if (playerError) throw playerError;
      }

      toast({
        title: "Partie modifiée",
        description: "Les modifications ont été sauvegardées",
      });

      setEditingSession(null);
      loadUserSessions();
      loadUserStats();
    } catch (error: any) {
      console.error('Error updating session:', error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier la partie",
        variant: "destructive",
      });
    }
  };

  const startCommentSession = (session: GameSession) => {
    setCommentingSession(session);
    setNewComment('');
  };

  const saveComment = async () => {
    if (!commentingSession || !newComment.trim()) return;

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          session_id: commentingSession.id,
          user_id: user!.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      toast({
        title: "Commentaire ajouté",
        description: "Votre commentaire a été publié",
      });

      setCommentingSession(null);
      setNewComment('');
      loadUserSessions(); // Refresh to show new comment
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le commentaire",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <TrendingUp className="animate-pulse mx-auto mb-4" size={48} />
        <p className="text-muted-foreground">Chargement de vos statistiques...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="mx-auto mb-2 text-primary" size={24} />
            <div className="text-2xl font-bold">{totalStats.total_sessions}</div>
            <div className="text-sm text-muted-foreground">Parties</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="mx-auto mb-2 text-yellow-500" size={24} />
            <div className="text-2xl font-bold">{totalStats.total_wins}</div>
            <div className="text-sm text-muted-foreground">Victoires</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="mx-auto mb-2 text-green-500" size={24} />
            <div className="text-2xl font-bold">{totalStats.win_rate}%</div>
            <div className="text-sm text-muted-foreground">Taux victoire</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="mx-auto mb-2 text-blue-500" size={24} />
            <div className="text-2xl font-bold">{totalStats.total_games}</div>
            <div className="text-sm text-muted-foreground">Jeux différents</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="mx-auto mb-2 text-purple-500" size={24} />
            <div className="text-2xl font-bold">{totalStats.avg_duration}min</div>
            <div className="text-sm text-muted-foreground">Durée moy.</div>
          </CardContent>
        </Card>
      </div>

      {/* Game Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiques par jeu</CardTitle>
          <CardDescription>Vos performances sur chaque jeu</CardDescription>
        </CardHeader>
        <CardContent>
          {gameStats.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p>Aucune statistique disponible</p>
              <p className="text-sm mt-1">Jouez quelques parties pour voir vos stats !</p>
            </div>
          ) : (
            <div className="space-y-4">
              {gameStats.map((game, index) => (
                <div key={game.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-lg font-semibold text-muted-foreground">#{index + 1}</div>
                    <div>
                      <h4 className="font-medium">{game.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {game.total_sessions} partie{game.total_sessions > 1 ? 's' : ''} • 
                        Dernière: {formatDate(game.last_played)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Badge variant="secondary">
                      {game.wins}/{game.total_sessions} victoires
                    </Badge>
                    <Badge variant={game.win_rate >= 50 ? "default" : "outline"}>
                      {game.win_rate}% de réussite
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Parties récentes</CardTitle>
          <CardDescription>Vos 10 dernières parties jouées</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar size={48} className="mx-auto mb-4 opacity-50" />
              <p>Aucune partie enregistrée</p>
              <p className="text-sm mt-2">Commencez par logger votre première partie !</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <Card key={session.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium">{session.game?.name || 'Jeu inconnu'}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(session.played_at)} • {session.duration_minutes} min
                        </p>
                         {session.players && session.players.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {session.players.map((player, idx) => {
                              return (
                                <Badge 
                                  key={idx} 
                                  variant={player.is_winner ? "default" : "secondary"}
                                  className="text-xs"
                                >
                                  {player.is_winner ? "🏆" : "💩"} 
                                  {player.is_session_owner && "👤 "}
                                  {player.player_name} ({player.score}pts)
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                        {session.notes && (
                          <p className="text-sm mt-2 italic text-muted-foreground">
                            "{session.notes}"
                          </p>
                        )}
                        {session.comments && session.comments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <h5 className="text-sm font-medium flex items-center">
                              <MessageCircle size={14} className="mr-1" />
                              Commentaires ({session.comments.length})
                            </h5>
                            {session.comments.map((comment) => (
                              <div key={comment.id} className="bg-muted p-2 rounded text-sm">
                                <p className="text-muted-foreground mb-1">
                                  <strong>Utilisateur</strong>
                                  {' • '}
                                  {formatDate(comment.created_at)}
                                </p>
                                <p>{comment.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-1 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startCommentSession(session)}
                        >
                          <MessageCircle size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditSession(session)}
                        >
                          <Edit2 size={14} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer la partie</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir supprimer cette partie ? Cette action ne peut pas être annulée.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteSession(session.id)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Session Dialog */}
      <Dialog open={!!editingSession} onOpenChange={() => setEditingSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la partie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-duration">Durée (minutes)</Label>
              <Input
                id="edit-duration"
                type="number"
                value={editDuration}
                onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                min="1"
              />
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Commentaires sur la partie..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
            <div>
              <Label>Joueurs et scores</Label>
              <div className="space-y-2 mt-2">
                {editPlayers.map((player, index) => {
                  // Find the highest position (last place) for the loser indicator
                  const maxPosition = Math.max(...editPlayers.map(p => p.position));
                  const isLoser = player.position === maxPosition && editPlayers.length > 1;
                  
                  return (
                    <div key={player.id} className="flex items-center space-x-2">
                      <Input
                        placeholder={`Joueur ${index + 1}`}
                        value={player.player_name}
                        onChange={(e) => updateEditPlayer(player.id, 'player_name', e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Score"
                        value={player.score || ''}
                        onChange={(e) => updateEditPlayer(player.id, 'score', parseInt(e.target.value) || 0)}
                        className="w-24"
                      />
                      {player.is_winner ? (
                        <span className="text-lg">🏆</span>
                      ) : (
                        <span className="text-lg">💩</span>
                      )}
                      {player.is_session_owner && (
                        <span className="text-xs text-muted-foreground">👤</span>
                      )}
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" onClick={calculateEditPositions}>
                  Recalculer les positions
                </Button>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingSession(null)}>
                <X size={16} className="mr-2" />
                Annuler
              </Button>
              <Button onClick={saveEditSession}>
                <Save size={16} className="mr-2" />
                Sauvegarder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog open={!!commentingSession} onOpenChange={() => setCommentingSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un commentaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Commentaire pour la partie de <strong>{commentingSession?.game?.name}</strong>
              </p>
              <Textarea
                placeholder="Votre commentaire..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setCommentingSession(null)}>
                <X size={16} className="mr-2" />
                Annuler
              </Button>
              <Button onClick={saveComment} disabled={!newComment.trim()}>
                <MessageCircle size={16} className="mr-2" />
                Publier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StatsAndSessions;