import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { Zap, MapPin, CheckCircle2, XCircle, Briefcase, Users, Building } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function MatchingPage() {
  const { getAuthHeaders } = useAuth();
  const [postes, setPostes] = useState([]);
  const [selectedPoste, setSelectedPoste] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => {
    const fetchPostes = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/postes`, { 
          headers: getAuthHeaders() 
        });
        setPostes(response.data);
        if (response.data.length > 0) {
          setSelectedPoste(response.data[0]);
        }
      } catch (error) {
        console.error('Error fetching postes:', error);
        toast.error('Erreur lors du chargement des postes');
      } finally {
        setLoading(false);
      }
    };

    fetchPostes();
  }, []);

  useEffect(() => {
    const fetchMatches = async () => {
      if (!selectedPoste) {
        setMatches([]);
        return;
      }

      setLoadingMatches(true);
      try {
        const response = await axios.get(
          `${API_URL}/api/matching/${selectedPoste.id}`,
          { headers: getAuthHeaders() }
        );
        setMatches(response.data);
      } catch (error) {
        console.error('Error fetching matches:', error);
        toast.error('Erreur lors du chargement des matchs');
      } finally {
        setLoadingMatches(false);
      }
    };

    fetchMatches();
  }, [selectedPoste]);

  const getScoreClass = (score) => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  };

  const getScoreLabel = (score) => {
    if (score >= 70) return 'Excellent';
    if (score >= 40) return 'Bon';
    return 'Partiel';
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="matching-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-heading text-primary tracking-tight">
          Matching
        </h1>
        <p className="text-muted-foreground mt-1">
          Trouvez les meilleurs candidats pour chaque poste
        </p>
      </div>

      {postes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Aucun poste disponible</p>
            <p className="text-sm">Créez d'abord des postes pour voir les matchs</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Postes List */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Postes ({postes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="p-2 space-y-1">
                  {postes.map((poste) => (
                    <button
                      key={poste.id}
                      onClick={() => setSelectedPoste(poste)}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        selectedPoste?.id === poste.id
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-secondary'
                      }`}
                      data-testid={`select-poste-${poste.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                          <Building className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{poste.titre_poste}</p>
                          <p className="text-sm text-muted-foreground truncate">{poste.entreprise}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3" />
                            {poste.ville}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Matches List */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Users className="h-5 w-5" />
                Candidats compatibles
                {selectedPoste && (
                  <Badge variant="secondary" className="ml-2">
                    {matches.length} résultat{matches.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </CardTitle>
              {selectedPoste && (
                <p className="text-sm text-muted-foreground">
                  Pour le poste de <span className="font-medium">{selectedPoste.titre_poste}</span> chez{' '}
                  <span className="font-medium">{selectedPoste.entreprise}</span>
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loadingMatches ? (
                <div className="py-12 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : matches.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Aucun candidat compatible</p>
                  <p className="text-sm">Ajoutez des candidats avec un profil correspondant</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="p-4 space-y-3">
                    {matches.map((match) => (
                      <div
                        key={match.candidat.id}
                        className="p-4 rounded-lg border border-border hover:border-primary/30 transition-all"
                        data-testid={`match-card-${match.candidat.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium flex-shrink-0">
                              {match.candidat.prenom.charAt(0)}{match.candidat.nom.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">
                                {match.candidat.prenom} {match.candidat.nom}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {match.candidat.titre_poste}
                              </p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3" />
                                {match.candidat.ville} ({match.candidat.rayon_km}km)
                              </div>
                              
                              {/* Match Details */}
                              <div className="flex flex-wrap gap-2 mt-3">
                                <span className={`match-indicator ${match.titre_match ? 'success' : 'muted'}`}>
                                  {match.titre_match ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                  ) : (
                                    <XCircle className="h-3 w-3" />
                                  )}
                                  Poste
                                </span>
                                <span className={`match-indicator ${match.zone_match ? 'success' : 'muted'}`}>
                                  {match.zone_match ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                  ) : (
                                    <XCircle className="h-3 w-3" />
                                  )}
                                  Zone
                                </span>
                                {match.candidat.disponibilite && (
                                  <Badge variant="outline" className="text-xs">
                                    {match.candidat.disponibilite}
                                  </Badge>
                                )}
                                {match.candidat.remuneration && (
                                  <Badge variant="outline" className="text-xs">
                                    {match.candidat.remuneration}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Score */}
                          <div className="flex flex-col items-center gap-1">
                            <span className={`score-badge ${getScoreClass(match.score)}`}>
                              {match.score}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {getScoreLabel(match.score)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
