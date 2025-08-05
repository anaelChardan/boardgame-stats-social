import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dice6, Users, BarChart3, Trophy } from 'lucide-react';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Index: Auth state changed', { loading, hasUser: !!user });
    if (!loading && !user) {
      console.log('Index: Redirecting to auth');
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Dice6 className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <header className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-primary text-primary-foreground">
              <Dice6 size={24} />
            </div>
            <h1 className="text-xl font-bold">Qui a pris la pétée</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              Bienvenue, {user.email}
            </span>
            <Button onClick={signOut} variant="outline" size="sm">
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Bienvenue dans votre journal de jeux !</h2>
          <p className="text-xl text-muted-foreground">
            Suivez vos parties, défiez vos amis, et célébrez vos victoires
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="text-center">
            <CardHeader>
              <div className="p-3 rounded-full bg-primary/10 text-primary mx-auto w-fit">
                <Dice6 size={32} />
              </div>
              <CardTitle>Logger une partie</CardTitle>
              <CardDescription>
                Enregistrez vos sessions de jeux avec les scores et les joueurs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full"
                onClick={() => console.log('Nouvelle partie clicked')}
              >
                Nouvelle partie
              </Button>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="p-3 rounded-full bg-accent/10 text-accent mx-auto w-fit">
                <Users size={32} />
              </div>
              <CardTitle>Mes amis</CardTitle>
              <CardDescription>
                Gérez votre communauté de joueurs et découvrez leurs parties
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => console.log('Voir mes amis clicked')}
              >
                Voir mes amis
              </Button>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="p-3 rounded-full bg-secondary/10 text-secondary-foreground mx-auto w-fit">
                <BarChart3 size={32} />
              </div>
              <CardTitle>Mes statistiques</CardTitle>
              <CardDescription>
                Découvrez vos jeux favoris, taux de victoire et plus
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => console.log('Voir les stats clicked')}
              >
                Voir les stats
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy size={24} />
              <span>Activité récente</span>
            </CardTitle>
            <CardDescription>
              Les dernières parties de votre communauté
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>Aucune activité récente</p>
              <p className="text-sm mt-2">Commencez par logger votre première partie !</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Index;
