import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Users, Briefcase, Zap, TrendingUp, Plus, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DashboardPage() {
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total_candidats: 0,
    total_postes: 0,
    total_matches: 0,
    high_score_matches: 0
  });
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, matchesRes] = await Promise.all([
          axios.get(`${API_URL}/api/stats`, { headers: getAuthHeaders() }),
          axios.get(`${API_URL}/api/matching`, { headers: getAuthHeaders() })
        ]);
        
        setStats(statsRes.data);
        
        // Get top matches from all positions
        const allMatches = matchesRes.data
          .flatMap(p => p.matches.map(m => ({ ...m, poste: p.poste })))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        setRecentMatches(allMatches);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getAuthHeaders]);

  const statCards = [
    {
      title: 'Candidats',
      value: stats.total_candidats,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      link: '/candidats'
    },
    {
      title: 'Postes',
      value: stats.total_postes,
      icon: Briefcase,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      link: '/postes'
    },
    {
      title: 'Matchs totaux',
      value: stats.total_matches,
      icon: Zap,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      link: '/matching'
    },
    {
      title: 'Matchs +70%',
      value: stats.high_score_matches,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      link: '/matching'
    }
  ];

  const getScoreClass = (score) => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading text-primary tracking-tight">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground mt-1">
            Vue d'ensemble de votre activité de recrutement
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => navigate('/candidats')} 
            variant="outline"
            data-testid="add-candidat-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Candidat
          </Button>
          <Button 
            onClick={() => navigate('/postes')}
            data-testid="add-poste-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Poste
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            className="stat-card cursor-pointer hover-lift"
            onClick={() => navigate(stat.link)}
            data-testid={`stat-${stat.title.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold font-heading mt-1">{stat.value}</p>
                </div>
                <div className={`h-12 w-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Matches & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Matches */}
        <Card className="lg:col-span-2" data-testid="recent-matches-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-heading">Meilleurs matchs récents</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/matching')}
              className="text-muted-foreground"
            >
              Voir tout
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentMatches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Aucun match pour le moment</p>
                <p className="text-sm">Ajoutez des candidats et des postes pour voir les matchs</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMatches.map((match, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {match.candidat.prenom} {match.candidat.nom}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {match.candidat.titre_poste} • {match.candidat.ville}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium">{match.poste.entreprise}</p>
                        <p className="text-xs text-muted-foreground">{match.poste.titre_poste}</p>
                      </div>
                      <span className={`score-badge ${getScoreClass(match.score)}`}>
                        {match.score}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card data-testid="quick-actions-card">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Actions rapides</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4"
              onClick={() => navigate('/candidats')}
            >
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center mr-3">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Ajouter un candidat</p>
                <p className="text-xs text-muted-foreground">Nouveau profil à placer</p>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4"
              onClick={() => navigate('/postes')}
            >
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center mr-3">
                <Briefcase className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Ajouter un poste</p>
                <p className="text-xs text-muted-foreground">Nouvelle offre à pourvoir</p>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4"
              onClick={() => navigate('/matching')}
            >
              <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center mr-3">
                <Zap className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Voir les matchs</p>
                <p className="text-xs text-muted-foreground">Candidats compatibles</p>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
