import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Zap, MapPin, CheckCircle2, XCircle, Briefcase, Users, Building, Plus, ArrowRight, FileCheck, FileX } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const STATUTS = [
  { code: "ENCV", label: "Envoyé au client", color: "bg-blue-100 text-blue-700" },
  { code: "ENTC", label: "Entretien client", color: "bg-purple-100 text-purple-700" },
  { code: "PROPALE", label: "Sous proposition", color: "bg-orange-100 text-orange-700" },
  { code: "PCLT", label: "Placé", color: "bg-green-100 text-green-700" },
  { code: "REFUS", label: "Refus propale", color: "bg-red-100 text-red-700" },
  { code: "NOGO_DISPO", label: "Plus disponible", color: "bg-gray-200 text-gray-600" }
];

export default function MatchingPage() {
  const { getAuthHeaders } = useAuth();
  const [postes, setPostes] = useState([]);
  const [selectedPoste, setSelectedPoste] = useState(null);
  const [matches, setMatches] = useState([]);
  const [existingProcesses, setExistingProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCandidat, setSelectedCandidat] = useState(null);
  const [processForm, setProcessForm] = useState({ statut: 'ENCV', notes: '' });
  const [submitting, setSubmitting] = useState(false);

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
        const [matchesRes, processRes] = await Promise.all([
          axios.get(`${API_URL}/api/matching/${selectedPoste.id}`, { headers: getAuthHeaders() }),
          axios.get(`${API_URL}/api/process/poste/${selectedPoste.id}`, { headers: getAuthHeaders() })
        ]);
        setMatches(matchesRes.data);
        setExistingProcesses(processRes.data);
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

  const getExistingProcess = (candidatId) => {
    return existingProcesses.find(p => p.candidat_id === candidatId);
  };

  const getStatutBadge = (statut) => {
    const s = STATUTS.find(st => st.code === statut) || STATUTS[0];
    return s;
  };

  const openProcessModal = (candidat) => {
    setSelectedCandidat(candidat);
    setProcessForm({ statut: 'ENCV', notes: '' });
    setIsModalOpen(true);
  };

  const createProcess = async (e) => {
    e.preventDefault();
    if (!selectedCandidat || !selectedPoste) return;
    
    setSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/api/process`,
        {
          candidat_id: selectedCandidat.id,
          poste_id: selectedPoste.id,
          statut: processForm.statut,
          notes: processForm.notes || null
        },
        { headers: getAuthHeaders() }
      );
      toast.success('Process créé !');
      setIsModalOpen(false);
      
      // Refresh processes
      const processRes = await axios.get(
        `${API_URL}/api/process/poste/${selectedPoste.id}`,
        { headers: getAuthHeaders() }
      );
      setExistingProcesses(processRes.data);
    } catch (error) {
      console.error('Error creating process:', error);
      const message = error.response?.data?.detail || 'Erreur lors de la création';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
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
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          poste.convention_signee ? 'bg-green-100' : 'bg-orange-100'
                        }`}>
                          <Building className={`h-5 w-5 ${
                            poste.convention_signee ? 'text-green-600' : 'text-orange-600'
                          }`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{poste.titre_poste}</p>
                            {poste.convention_signee ? (
                              <FileCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <FileX className="h-4 w-4 text-orange-500 flex-shrink-0" />
                            )}
                          </div>
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Pour le poste de <span className="font-medium">{selectedPoste.titre_poste}</span> chez{' '}
                  <span className="font-medium">{selectedPoste.entreprise}</span></span>
                  {selectedPoste.convention_signee ? (
                    <Badge className="bg-green-100 text-green-700 text-xs">
                      <FileCheck className="h-3 w-3 mr-1" />
                      CV nominatif OK
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-orange-300 text-orange-600 text-xs">
                      <FileX className="h-3 w-3 mr-1" />
                      CV anonyme
                    </Badge>
                  )}
                </div>
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
                    {matches.map((match) => {
                      const existingProcess = getExistingProcess(match.candidat.id);
                      const statutInfo = existingProcess ? getStatutBadge(existingProcess.statut) : null;
                      
                      return (
                        <div
                          key={match.candidat.id}
                          className={`p-4 rounded-lg border transition-all ${
                            existingProcess 
                              ? 'border-primary/30 bg-primary/5' 
                              : 'border-border hover:border-primary/30'
                          }`}
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

                                {/* Process Status */}
                                {existingProcess && (
                                  <div className="mt-3 flex items-center gap-2">
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statutInfo.color}`}>
                                      {statutInfo.label}
                                    </span>
                                    {existingProcess.notes && (
                                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                                        {existingProcess.notes}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Score & Action */}
                            <div className="flex flex-col items-end gap-2">
                              <span className={`score-badge ${getScoreClass(match.score)}`}>
                                {match.score}%
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {getScoreLabel(match.score)}
                              </span>
                              
                              {!existingProcess && (
                                <Button 
                                  size="sm" 
                                  onClick={() => openProcessModal(match.candidat)}
                                  data-testid={`start-process-${match.candidat.id}`}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Process
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Process Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-heading">
              Démarrer un process
            </DialogTitle>
          </DialogHeader>
          {selectedCandidat && selectedPoste && (
            <form onSubmit={createProcess}>
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                      {selectedCandidat.prenom.charAt(0)}{selectedCandidat.nom.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{selectedCandidat.prenom} {selectedCandidat.nom}</p>
                      <p className="text-sm text-muted-foreground">{selectedCandidat.titre_poste}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center my-2">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                      <Building className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedPoste.titre_poste}</p>
                      <p className="text-sm text-muted-foreground">{selectedPoste.entreprise}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="statut">Statut initial</Label>
                  <Select 
                    value={processForm.statut} 
                    onValueChange={(value) => setProcessForm({ ...processForm, statut: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUTS.map(s => (
                        <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optionnel)</Label>
                  <Textarea
                    id="notes"
                    value={processForm.notes}
                    onChange={(e) => setProcessForm({ ...processForm, notes: e.target.value })}
                    placeholder="Notes sur ce process..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Création...' : 'Créer le process'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
