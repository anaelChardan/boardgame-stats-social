import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Users, Clock, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
    player_name: string;
    score: number;
    position: number;
    is_winner: boolean;
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
          players:game_session_players(player_name, score, position, is_winner)
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
          players:game_session_players(player_name, score, position, is_winner)
        `)
        .eq('user_id', user.id);

      if (sessionsError) throw sessionsError;

      const sessions = sessionsData as any[] || [];
      
      // Calculate total stats
      const totalSessions = sessions.length;
      const totalWins = sessions.reduce((wins, session) => {
        const userPlayer = session.players?.find((p: any) => p.is_winner && p.player_name);
        return wins + (userPlayer ? 1 : 0);
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
        
        const userPlayer = session.players?.find((p: any) => p.is_winner && p.player_name);
        if (userPlayer) {
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
                      <div>
                        <h4 className="font-medium">{session.game?.name || 'Jeu inconnu'}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(session.played_at)} • {session.duration_minutes} min
                        </p>
                        {session.players && session.players.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {session.players.map((player, idx) => (
                              <Badge 
                                key={idx} 
                                variant={player.is_winner ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {player.is_winner && <Trophy size={12} className="mr-1" />}
                                {player.player_name} ({player.score}pts)
                              </Badge>
                            ))}
                          </div>
                        )}
                        {session.notes && (
                          <p className="text-sm mt-2 italic text-muted-foreground">
                            "{session.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsAndSessions;