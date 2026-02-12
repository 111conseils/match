import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Users, Briefcase, Zap } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Connexion réussie !');
      } else {
        await register(email, password);
        toast.success('Compte créé avec succès !');
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Une erreur est survenue';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="login-left-panel">
        <div className="max-w-md text-white">
          <h1 className="text-4xl font-bold font-heading mb-4 tracking-tight">
            111MATCHING
          </h1>
          <p className="text-lg text-white/80 mb-8">
            Simplifiez votre recrutement avec un matching intelligent entre candidats et postes.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Gestion des candidats</h3>
                <p className="text-sm text-white/70">Centralisez tous vos profils</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Suivi des postes</h3>
                <p className="text-sm text-white/70">Organisez vos offres par zone</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Matching automatique</h3>
                <p className="text-sm text-white/70">Trouvez les meilleurs profils</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="login-right-panel">
        <Card className="w-full max-w-md border-border shadow-sm">
          <CardHeader className="space-y-1">
            <div className="lg:hidden mb-4">
              <h1 className="text-2xl font-bold font-heading text-primary">111MATCHING</h1>
            </div>
            <CardTitle className="text-2xl font-heading">
              {isLogin ? 'Connexion' : 'Créer un compte'}
            </CardTitle>
            <CardDescription>
              {isLogin 
                ? 'Entrez vos identifiants pour accéder à votre espace' 
                : 'Remplissez le formulaire pour créer votre compte'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="login-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="login-password-input"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
                data-testid="login-submit-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Chargement...
                  </span>
                ) : (
                  isLogin ? 'Se connecter' : 'Créer le compte'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Application privée - 111 conseils
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
