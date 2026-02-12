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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Zap, MapPin, CheckCircle2, Briefcase, Users, Building, Plus, ArrowRight, FileCheck, FileX, User } from 'lucide-react';
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
  const [candidats, setCandidats] = useState([]);
  const [selectedPoste, setSelectedPoste] = useState(null);
  const [selectedCandidat, setSelectedCandidat] = useState(null);
  const [matchesForPoste, setMatchesForPoste] = useState([]);
  const [matchesForCandidat, setMatchesForCandidat] = useState([]);
  const [existingProcesses, setExistingProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [activeTab, setActiveTab] = useState('postes');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCandidat, setModalCandidat] = useState(null);
  const [modalPoste, setModalPoste] = useState(null);
  const [processForm, setProcessForm] = useState({ statut: 'ENCV', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [postesRes, candidatsRes, processRes] = await Promise.all([
          axios.get(`${API_URL}/api/postes`, { headers: getAuthHeaders() }),
          axios.get(`${API_URL}/api/candidats`, { headers: getAuthHeaders() }),
          axios.get(`${API_URL}/api/process`, { headers: getAuthHeaders() })
        ]);
        setPostes(postesRes.data);
        setCandidats(candidatsRes.data);
        setExistingProcesses(processRes.data);
        
        if (postesRes.data.length > 0) {
          setSelectedPoste(postesRes.data[0]);
        }
        if (candidatsRes.data.length > 0) {
          setSelectedCandidat(candidatsRes.data[0]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch matches for selected poste
  useEffect(() => {
    const fetchMatchesForPoste = async () => {
      if (!selectedPoste) {
        setMatchesForPoste([]);
        return;
      }

      setLoadingMatches(true);
      try {
        const response = await axios.get(
          `${API_URL}/api/matching/${selectedPoste.id}`,
          { headers: getAuthHeaders() }
        );
        // Filtrer seulement les matchs à 100%
        const perfectMatches = response.data.filter(m => m.score === 100);
        setMatchesForPoste(perfectMatches);
      } catch (error) {
        console.error('Error fetching matches:', error);
      } finally {
        setLoadingMatches(false);
      }
    };

    if (activeTab === 'postes') {
      fetchMatchesForPoste();
    }
  }, [selectedPoste, activeTab]);

  // Fetch matches for selected candidat
  useEffect(() => {
    const fetchMatchesForCandidat = async () => {
      if (!selectedCandidat) {
        setMatchesForCandidat([]);
        return;
      }

      setLoadingMatches(true);
      try {
        const response = await axios.get(
          `${API_URL}/api/matching/candidat/${selectedCandidat.id}`,
          { headers: getAuthHeaders() }
        );
        // Filtrer seulement les matchs à 100%
        const perfectMatches = response.data.filter(m => m.score === 100);
        setMatchesForCandidat(perfectMatches);
      } catch (error) {
        console.error('Error fetching matches for candidat:', error);
      } finally {
        setLoadingMatches(false);
      }
    };

    if (activeTab === 'candidats') {
      fetchMatchesForCandidat();
    }
  }, [selectedCandidat, activeTab]);

  const getExistingProcess = (candidatId, posteId) => {
    return existingProcesses.find(p => p.candidat_id === candidatId && p.poste_id === posteId);
  };

  const getStatutBadge = (statut) => {
    const s = STATUTS.find(st => st.code === statut) || STATUTS[0];
    return s;
  };

  const openProcessModal = (candidat, poste) => {
    setModalCandidat(candidat);
    setModalPoste(poste);
    setProcessForm({ statut: 'ENCV', notes: '' });
    setIsModalOpen(true);
  };

  const createProcess = async (e) => {
    e.preventDefault();
    if (!modalCandidat || !modalPoste) return;
    
    setSubmitting(true);
    try {
      await axios.post(
        `${API_URL}/api/process`,
        {
          candidat_id: modalCandidat.id,
          poste_id: modalPoste.id,
          statut: processForm.statut,
          notes: processForm.notes || null
        },
        { headers: getAuthHeaders() }
      );
      toast.success('Process créé !');
      setIsModalOpen(false);
      
      // Refresh processes
      const processRes = await axios.get(`${API_URL}/api/process`, { headers: getAuthHeaders() });
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
          Matchs parfaits (100%) entre candidats et postes
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="postes" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Par Poste
          </TabsTrigger>
          <TabsTrigger value="candidats" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Par Candidat
          </TabsTrigger>
        </TabsList>

        {/* Tab: Par Poste */}
        <TabsContent value="postes" className="mt-6">
          {postes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Aucun poste disponible</p>
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
                                {poste.ville} {poste.code_postal && `(${poste.code_postal})`}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Candidats matching */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Candidats compatibles (100%)
                    {selectedPoste && (
                      <Badge variant="secondary" className="ml-2">
                        {matchesForPoste.length} résultat{matchesForPoste.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </CardTitle>
                  {selectedPoste && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Pour <span className="font-medium">{selectedPoste.titre_poste}</span> chez <span className="font-medium">{selectedPoste.entreprise}</span></span>
                      {selectedPoste.convention_signee ? (
                        <Badge className="bg-green-100 text-green-700 text-xs">CV nominatif OK</Badge>
                      ) : (
                        <Badge variant="outline" className="border-orange-300 text-orange-600 text-xs">CV anonyme</Badge>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {loadingMatches ? (
                    <div className="py-12 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : matchesForPoste.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">Aucun match parfait</p>
                      <p className="text-sm">Aucun candidat ne correspond à 100% à ce poste</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[450px]">
                      <div className="p-4 space-y-3">
                        {matchesForPoste.map((match) => {
                          const existingProcess = getExistingProcess(match.candidat.id, selectedPoste.id);
                          const statutInfo = existingProcess ? getStatutBadge(existingProcess.statut) : null;
                          
                          return (
                            <div
                              key={match.candidat.id}
                              className={`p-4 rounded-lg border transition-all ${
                                existingProcess ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/30'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-medium flex-shrink-0">
                                    {match.candidat.prenom.charAt(0)}{match.candidat.nom.charAt(0)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold">{match.candidat.prenom} {match.candidat.nom}</p>
                                    <p className="text-sm text-muted-foreground">{match.candidat.titre_poste}</p>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                      <MapPin className="h-3 w-3" />
                                      {match.candidat.ville} {match.candidat.code_postal && `(${match.candidat.code_postal})`} • {match.candidat.rayon_km}km
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2 mt-3">
                                      <span className="match-indicator success">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Poste ✓
                                      </span>
                                      <span className="match-indicator success">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Zone ✓
                                      </span>
                                      {match.candidat.disponibilite && (
                                        <Badge variant="outline" className="text-xs">{match.candidat.disponibilite}</Badge>
                                      )}
                                      {match.candidat.remuneration && (
                                        <Badge variant="outline" className="text-xs">{match.candidat.remuneration}</Badge>
                                      )}
                                    </div>

                                    {existingProcess && (
                                      <div className="mt-3 flex items-center gap-2">
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statutInfo.color}`}>
                                          {statutInfo.label}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2">
                                  <span className="score-badge high">100%</span>
                                  {!existingProcess && (
                                    <Button size="sm" onClick={() => openProcessModal(match.candidat, selectedPoste)}>
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
        </TabsContent>

        {/* Tab: Par Candidat */}
        <TabsContent value="candidats" className="mt-6">
          {candidats.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Aucun candidat disponible</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Candidats List */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Candidats ({candidats.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <div className="p-2 space-y-1">
                      {candidats.map((candidat) => (
                        <button
                          key={candidat.id}
                          onClick={() => setSelectedCandidat(candidat)}
                          className={`w-full text-left p-4 rounded-lg border transition-all ${
                            selectedCandidat?.id === candidat.id
                              ? 'border-primary bg-primary/5'
                              : 'border-transparent hover:bg-secondary'
                          }`}
                          data-testid={`select-candidat-${candidat.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium flex-shrink-0">
                              {candidat.prenom.charAt(0)}{candidat.nom.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{candidat.prenom} {candidat.nom}</p>
                              <p className="text-sm text-muted-foreground truncate">{candidat.titre_poste}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3" />
                                {candidat.ville} • {candidat.rayon_km}km
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Postes matching */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Postes compatibles (100%)
                    {selectedCandidat && (
                      <Badge variant="secondary" className="ml-2">
                        {matchesForCandidat.length} résultat{matchesForCandidat.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </CardTitle>
                  {selectedCandidat && (
                    <p className="text-sm text-muted-foreground">
                      Pour <span className="font-medium">{selectedCandidat.prenom} {selectedCandidat.nom}</span> - {selectedCandidat.titre_poste}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {loadingMatches ? (
                    <div className="py-12 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : matchesForCandidat.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">Aucun match parfait</p>
                      <p className="text-sm">Aucun poste ne correspond à 100% à ce candidat</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[450px]">
                      <div className="p-4 space-y-3">
                        {matchesForCandidat.map((match) => {
                          const existingProcess = getExistingProcess(selectedCandidat.id, match.poste.id);
                          const statutInfo = existingProcess ? getStatutBadge(existingProcess.statut) : null;
                          
                          return (
                            <div
                              key={match.poste.id}
                              className={`p-4 rounded-lg border transition-all ${
                                existingProcess ? 'border-primary/30 bg-primary/5' : 'border-border hover:border-primary/30'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    match.poste.convention_signee ? 'bg-green-100' : 'bg-orange-100'
                                  }`}>
                                    <Building className={`h-6 w-6 ${
                                      match.poste.convention_signee ? 'text-green-600' : 'text-orange-600'
                                    }`} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold">{match.poste.titre_poste}</p>
                                      {match.poste.convention_signee ? (
                                        <Badge className="bg-green-100 text-green-700 text-xs">CV nominatif</Badge>
                                      ) : (
                                        <Badge variant="outline" className="border-orange-300 text-orange-600 text-xs">CV anonyme</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{match.poste.entreprise}</p>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                      <MapPin className="h-3 w-3" />
                                      {match.poste.ville} {match.poste.code_postal && `(${match.poste.code_postal})`}
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2 mt-3">
                                      <span className="match-indicator success">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Poste ✓
                                      </span>
                                      <span className="match-indicator success">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Zone ✓
                                      </span>
                                      {match.poste.contact && (
                                        <Badge variant="outline" className="text-xs">{match.poste.contact}</Badge>
                                      )}
                                    </div>

                                    {existingProcess && (
                                      <div className="mt-3 flex items-center gap-2">
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statutInfo.color}`}>
                                          {statutInfo.label}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2">
                                  <span className="score-badge high">100%</span>
                                  {!existingProcess && (
                                    <Button size="sm" onClick={() => openProcessModal(selectedCandidat, match.poste)}>
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
        </TabsContent>
      </Tabs>

      {/* Create Process Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-heading">Démarrer un process</DialogTitle>
          </DialogHeader>
          {modalCandidat && modalPoste && (
            <form onSubmit={createProcess}>
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                      {modalCandidat.prenom.charAt(0)}{modalCandidat.nom.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{modalCandidat.prenom} {modalCandidat.nom}</p>
                      <p className="text-sm text-muted-foreground">{modalCandidat.titre_poste}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center my-2">
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      modalPoste.convention_signee ? 'bg-green-100' : 'bg-orange-100'
                    }`}>
                      <Building className={`h-5 w-5 ${
                        modalPoste.convention_signee ? 'text-green-600' : 'text-orange-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium">{modalPoste.titre_poste}</p>
                      <p className="text-sm text-muted-foreground">{modalPoste.entreprise}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="statut">Statut initial</Label>
                  <Select value={processForm.statut} onValueChange={(value) => setProcessForm({ ...processForm, statut: value })}>
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
