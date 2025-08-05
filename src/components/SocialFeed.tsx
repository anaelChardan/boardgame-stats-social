import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Trophy, Clock, Calendar, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface GameSessionFeed {
  id: string;
  played_at: string;
  duration_minutes: number;
  notes: string | null;
  user_profile: {
    username: string | null;
    display_name: string | null;
  };
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
  likes_count: number;
  comments_count: number;
  user_has_liked: boolean;
}

const SocialFeed = () => {
  const { user } = useAuth();
  const [feed, setFeed] = useState<GameSessionFeed[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadSocialFeed();
    }
  }, [user]);

  const loadSocialFeed = async () => {
    if (!user) return;

    try {
      // Get game sessions from friends and self
      const { data: sessions, error: sessionsError } = await supabase
        .from('game_sessions')
        .select(`
          id,
          user_id,
          played_at,
          duration_minutes,
          notes,
          game:games(name, image_url),
          players:game_session_players(player_name, score, position, is_winner),
          user_profile:profiles!game_sessions_user_id_fkey(username, display_name)
        `)
        .order('played_at', { ascending: false })
        .limit(20);

      if (sessionsError) throw sessionsError;

      // Get likes count for each session
      const sessionIds = (sessions || []).map(s => s.id);
      const { data: likesData } = await supabase
        .from('likes')
        .select('session_id, user_id')
        .in('session_id', sessionIds);

      // Get comments count for each session  
      const { data: commentsData } = await supabase
        .from('comments')
        .select('session_id')
        .in('session_id', sessionIds);

      // Combine data
      const feedWithStats = (sessions || []).map(session => {
        const sessionLikes = (likesData || []).filter(like => like.session_id === session.id);
        const sessionComments = (commentsData || []).filter(comment => comment.session_id === session.id);
        const userHasLiked = sessionLikes.some(like => like.user_id === user.id);

        return {
          ...session,
          likes_count: sessionLikes.length,
          comments_count: sessionComments.length,
          user_has_liked: userHasLiked
        };
      });

      setFeed(feedWithStats as any);
    } catch (error: any) {
      console.error('Error loading social feed:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le feed social",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLike = async (sessionId: string) => {
    if (!user) return;

    try {
      const session = feed.find(s => s.id === sessionId);
      if (!session) return;

      if (session.user_has_liked) {
        // Unlike
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('session_id', sessionId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from('likes')
          .insert({
            session_id: sessionId,
            user_id: user.id
          });

        if (error) throw error;
      }

      // Update local state
      setFeed(prevFeed => 
        prevFeed.map(item => 
          item.id === sessionId 
            ? {
                ...item,
                user_has_liked: !item.user_has_liked,
                likes_count: item.user_has_liked ? item.likes_count - 1 : item.likes_count + 1
              }
            : item
        )
      );
    } catch (error: any) {
      console.error('Error toggling like:', error);
      toast({
        title: "Erreur",
        description: "Impossible de liker cette partie",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateRelative = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Il y a moins d\'une heure';
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return formatDate(dateString);
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Users className="animate-pulse mx-auto mb-4" size={48} />
        <p className="text-muted-foreground">Chargement du feed social...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Activité de la communauté</h2>
        <p className="text-muted-foreground">
          Découvrez les dernières parties de vos amis et de la communauté
        </p>
      </div>

      {feed.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2">Aucune activité récente</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Il n'y a pas encore d'activité dans votre communauté.
            </p>
            <p className="text-sm text-muted-foreground">
              Commencez par ajouter des amis et logger vos parties !
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {feed.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users size={20} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">
                        {session.user_profile?.display_name || session.user_profile?.username || 'Joueur'}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        a joué à <span className="font-medium">{session.game?.name}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {formatDateRelative(session.played_at)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Game info */}
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Clock size={16} />
                  <span>{session.duration_minutes} minutes</span>
                  <Calendar size={16} className="ml-2" />
                  <span>{formatDate(session.played_at)}</span>
                </div>

                {/* Players and scores */}
                {session.players && session.players.length > 0 && (
                  <div>
                    <h5 className="font-medium mb-2 flex items-center">
                      <Trophy size={16} className="mr-2" />
                      Résultats
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {session.players
                        .sort((a, b) => a.position - b.position)
                        .map((player, idx) => (
                        <Badge 
                          key={idx} 
                          variant={player.is_winner ? "default" : "secondary"}
                          className="flex items-center gap-1"
                        >
                          {player.position === 1 && <Trophy size={12} />}
                          <span>#{player.position}</span>
                          <span>{player.player_name}</span>
                          <span>({player.score}pts)</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {session.notes && (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm italic">"{session.notes}"</p>
                  </div>
                )}

                {/* Social actions */}
                <div className="flex items-center space-x-4 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleLike(session.id)}
                    className={session.user_has_liked ? "text-red-500" : ""}
                  >
                    <Heart 
                      size={16} 
                      className="mr-1" 
                      fill={session.user_has_liked ? "currentColor" : "none"}
                    />
                    {session.likes_count} J'aime
                  </Button>
                  
                  <Button variant="ghost" size="sm">
                    <MessageCircle size={16} className="mr-1" />
                    {session.comments_count} Commentaires
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SocialFeed;