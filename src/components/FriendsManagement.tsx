import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, UserMinus, Check, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  friend_profile: Profile;
}

const FriendsManagement = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (user) {
      loadFriends();
      loadPendingRequests();
    }
  }, [user]);

  const loadFriends = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          id,
          user_id,
          friend_id,
          status,
          created_at,
          friend_profile:profiles(id, user_id, username, display_name, avatar_url)
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (error) throw error;
      setFriends((data as any) || []);
    } catch (error: any) {
      console.error('Error loading friends:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger vos amis",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    if (!user) return;

    try {
      // Get pending requests sent to me
      const { data, error } = await supabase
        .from('friends')
        .select(`
          id,
          user_id,
          friend_id,
          status,
          created_at,
          friend_profile:profiles(id, user_id, username, display_name, avatar_url)
        `)
        .eq('friend_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;
      setPendingRequests((data as any) || []);
    } catch (error: any) {
      console.error('Error loading pending requests:', error);
    }
  };

  const sendFriendRequest = async () => {
    if (!user || !searchEmail.trim()) return;

    setIsSearching(true);
    try {
      // First, find the user by email through auth.users (we can't query this directly)
      // So we'll use a different approach - search by username in profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${searchEmail}%`)
        .limit(5);

      if (profileError) throw profileError;

      if (!profiles || profiles.length === 0) {
        toast({
          title: "Utilisateur non trouvé",
          description: "Aucun utilisateur trouvé avec ce nom d'utilisateur",
          variant: "destructive",
        });
        return;
      }

      // For now, take the first match
      const targetProfile = profiles[0];

      // Check if already friends or request exists
      const { data: existingFriend } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${targetProfile.user_id}),and(user_id.eq.${targetProfile.user_id},friend_id.eq.${user.id})`)
        .single();

      if (existingFriend) {
        toast({
          title: "Demande déjà envoyée",
          description: "Une demande d'ami existe déjà avec cet utilisateur",
          variant: "destructive",
        });
        return;
      }

      // Send friend request
      const { error } = await supabase
        .from('friends')
        .insert({
          user_id: user.id,
          friend_id: targetProfile.user_id,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Demande envoyée !",
        description: `Demande d'ami envoyée à ${targetProfile.display_name || targetProfile.username}`,
      });

      setSearchEmail('');
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      toast({
        title: "Erreur",
        description: error?.message || "Impossible d'envoyer la demande d'ami",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const respondToFriendRequest = async (requestId: string, accept: boolean) => {
    try {
      if (accept) {
        const { error } = await supabase
          .from('friends')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        if (error) throw error;

        toast({
          title: "Demande acceptée !",
          description: "Vous êtes maintenant amis",
        });
      } else {
        const { error } = await supabase
          .from('friends')
          .delete()
          .eq('id', requestId);

        if (error) throw error;

        toast({
          title: "Demande refusée",
          description: "La demande d'ami a été refusée",
        });
      }

      loadFriends();
      loadPendingRequests();
    } catch (error: any) {
      console.error('Error responding to friend request:', error);
      toast({
        title: "Erreur",
        description: "Impossible de répondre à la demande",
        variant: "destructive",
      });
    }
  };

  const removeFriend = async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      toast({
        title: "Ami supprimé",
        description: "L'ami a été retiré de votre liste",
      });

      loadFriends();
    } catch (error: any) {
      console.error('Error removing friend:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'ami",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Users className="animate-spin mx-auto mb-4" size={48} />
        <p className="text-muted-foreground">Chargement de vos amis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add friend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <UserPlus size={24} />
            <span>Ajouter un ami</span>
          </CardTitle>
          <CardDescription>
            Recherchez un ami par son nom d'utilisateur
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            <Input
              placeholder="Nom d'utilisateur..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendFriendRequest()}
            />
            <Button 
              onClick={sendFriendRequest}
              disabled={isSearching || !searchEmail.trim()}
            >
              {isSearching ? 'Recherche...' : 'Envoyer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Demandes d'amis reçues</CardTitle>
            <CardDescription>
              {pendingRequests.length} demande(s) en attente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-medium">
                      {request.friend_profile.display_name || request.friend_profile.username || 'Utilisateur'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      @{request.friend_profile.username}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => respondToFriendRequest(request.id, true)}
                    >
                      <Check size={16} className="mr-1" />
                      Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => respondToFriendRequest(request.id, false)}
                    >
                      <X size={16} className="mr-1" />
                      Refuser
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Friends list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users size={24} />
            <span>Mes amis ({friends.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {friends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>Aucun ami pour le moment</p>
              <p className="text-sm mt-2">Commencez par ajouter des amis pour partager vos parties !</p>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users size={20} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">
                        {friend.friend_profile.display_name || friend.friend_profile.username || 'Utilisateur'}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        @{friend.friend_profile.username}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">Ami</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeFriend(friend.id)}
                    >
                      <UserMinus size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FriendsManagement;