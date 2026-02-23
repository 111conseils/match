import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Search, MoreHorizontal, Pencil, Trash2, ArrowRight, Euro, Building, User, Download, Briefcase, MapPin, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const STATUTS = [
  { code: "ENCV", label: "Envoyé au client", color: "bg-blue-100 text-blue-700", dotColor: "bg-blue-500" },
  { code: "ENTC", label: "Entretien client", color: "bg-purple-100 text-purple-700", dotColor: "bg-purple-500" },
  { code: "PROPALE", label: "Sous proposition", color: "bg-orange-100 text-orange-700", dotColor: "bg-orange-500" },
  { code: "PCLT", label: "Placé", color: "bg-green-100 text-green-700", dotColor: "bg-green-500" },
  { code: "REFUS", label: "Refus", color: "bg-red-100 text-red-700", dotColor: "bg-red-500" },
  { code: "NOGO_DISPO", label: "NOGO", color: "bg-gray-200 text-gray-600", dotColor: "bg-gray-500" }
];

export default function ProcessPage() {
  const { getAuthHeaders } = useAuth();
  const [processes, setProcesses] = useState([]);
  const [candidats, setCandidats] = useState([]);
  const [postes, setPostes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatut, setFilterStatut] = useState('ALL');
  const [activeTab, setActiveTab] = useState('candidats');
  const [selectedCandidat, setSelectedCandidat] = useState(null);
  const [selectedPoste, setSelectedPoste] = useState(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProcess, setCurrentProcess] = useState(null);
  const [formData, setFormData] = useState({
    statut: 'ENCV',
    honoraire: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [processRes, candidatsRes, postesRes] = await Promise.all([
        axios.get(`${API_URL}/api/process`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/api/candidats`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/api/postes`, { headers: getAuthHeaders() })
      ]);
      setProcesses(processRes.data);
      setCandidats(candidatsRes.data.filter(c => !c.is_archived));
      setPostes(postesRes.data);
      
      // Sélectionner le premier candidat/poste par défaut
      if (candidatsRes.data.length > 0 && !selectedCandidat) {
        setSelectedCandidat(candidatsRes.data.filter(c => !c.is_archived)[0]);
      }
      if (postesRes.data.length > 0 && !selectedPoste) {
        setSelectedPoste(postesRes.data[0]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openEditModal = (proc) => {
    setFormData({
      statut: proc.statut,
      honoraire: proc.honoraire || '',
      notes: proc.notes || ''
    });
    setCurrentProcess(proc);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentProcess) return;
    
    setSubmitting(true);
    try {
      await axios.put(
        `${API_URL}/api/process/${currentProcess.id}`,
        { 
          statut: formData.statut, 
          honoraire: formData.honoraire ? parseFloat(formData.honoraire) : null, 
          notes: formData.notes || null 
        },
        { headers: getAuthHeaders() }
      );
      toast.success('Process mis à jour');
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving process:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce process ?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/process/${id}`, { headers: getAuthHeaders() });
      toast.success('Process supprimé');
      fetchData();
    } catch (error) {
      console.error('Error deleting process:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const updateStatut = async (proc, newStatut) => {
    try {
      await axios.put(
        `${API_URL}/api/process/${proc.id}`,
        { statut: newStatut },
        { headers: getAuthHeaders() }
      );
      toast.success('Statut mis à jour');
      fetchData();
    } catch (error) {
      console.error('Error updating statut:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const getStatutBadge = (statut) => {
    return STATUTS.find(st => st.code === statut) || STATUTS[0];
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`${API_URL}/api/export/process`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `process_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Export téléchargé !');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    }
  };

  // Grouper les process par candidat
  const getProcessesByCandidat = (candidatId) => {
    return processes.filter(p => p.candidat_id === candidatId);
  };

  // Grouper les process par poste
  const getProcessesByPoste = (posteId) => {
    return processes.filter(p => p.poste_id === posteId);
  };

  // Filtrer les candidats qui ont au moins un process
  const candidatsWithProcess = candidats.filter(c => 
    processes.some(p => p.candidat_id === c.id)
  );

  // Filtrer les postes qui ont au moins un process
  const postesWithProcess = postes.filter(p => 
    processes.some(proc => proc.poste_id === p.id)
  );

  // Stats
  const totalProcess = processes.length;
  const encvCount = processes.filter(p => p.statut === 'ENCV').length;
  const entcCount = processes.filter(p => p.statut === 'ENTC').length;
  const placesCount = processes.filter(p => p.statut === 'PCLT').length;

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="process-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading text-primary tracking-tight">
            Suivi des Process
          </h1>
          <div className="flex flex-wrap gap-3 mt-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {encvCount} envoyés
            </Badge>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              {entcCount} en entretien
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {placesCount} placés
            </Badge>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport} data-testid="export-process-btn">
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="candidats" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Par Candidat
          </TabsTrigger>
          <TabsTrigger value="postes" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Par Poste
          </TabsTrigger>
        </TabsList>

        {/* Vue par Candidat */}
        <TabsContent value="candidats" className="mt-6">
          {candidatsWithProcess.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Aucun process en cours</p>
                <p className="text-sm">Créez des process depuis la page Matching</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Liste des candidats */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Candidats ({candidatsWithProcess.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <div className="p-2 space-y-1">
                      {candidatsWithProcess.map((candidat) => {
                        const candidatProcesses = getProcessesByCandidat(candidat.id);
                        const activeCount = candidatProcesses.filter(p => !['PCLT', 'REFUS', 'NOGO_DISPO'].includes(p.statut)).length;
                        
                        return (
                          <button
                            key={candidat.id}
                            onClick={() => setSelectedCandidat(candidat)}
                            className={`w-full text-left p-4 rounded-lg border transition-all ${
                              selectedCandidat?.id === candidat.id
                                ? 'border-primary bg-primary/5'
                                : 'border-transparent hover:bg-secondary'
                            }`}
                            data-testid={`select-candidat-process-${candidat.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                                  {candidat.prenom?.charAt(0)}{candidat.nom?.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium">{candidat.prenom} {candidat.nom}</p>
                                  <p className="text-xs text-muted-foreground">{candidat.titre_poste}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  {candidatProcesses.length} envoi{candidatProcesses.length > 1 ? 's' : ''}
                                </Badge>
                                {activeCount > 0 && (
                                  <span className="text-xs text-blue-600">{activeCount} actif{activeCount > 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Détails des envois du candidat */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Envois de {selectedCandidat?.prenom} {selectedCandidat?.nom}
                  </CardTitle>
                  {selectedCandidat && (
                    <p className="text-sm text-muted-foreground">
                      {selectedCandidat.titre_poste} • {selectedCandidat.ville}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {selectedCandidat && getProcessesByCandidat(selectedCandidat.id).length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <p>Aucun envoi pour ce candidat</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCandidat && getProcessesByCandidat(selectedCandidat.id).map((proc) => {
                        const statutInfo = getStatutBadge(proc.statut);
                        return (
                          <div
                            key={proc.id}
                            className="p-4 rounded-lg border bg-card hover:shadow-sm transition-all"
                            data-testid={`process-item-${proc.id}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1">
                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                  proc.poste?.convention_signee ? 'bg-green-100' : 'bg-orange-100'
                                }`}>
                                  <Building className={`h-5 w-5 ${
                                    proc.poste?.convention_signee ? 'text-green-600' : 'text-orange-600'
                                  }`} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold">{proc.poste?.entreprise}</p>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-muted-foreground">{proc.poste?.titre_poste}</p>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">{proc.poste?.ville}</span>
                                    {proc.poste?.contact && (
                                      <>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="text-xs text-muted-foreground">{proc.poste?.contact}</span>
                                      </>
                                    )}
                                  </div>
                                  {proc.notes && (
                                    <p className="text-sm text-muted-foreground mt-2 italic">"{proc.notes}"</p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className={`px-3 py-1.5 rounded-full text-xs font-medium ${statutInfo.color} cursor-pointer hover:opacity-80 transition-opacity`}>
                                      {statutInfo.label}
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {STATUTS.map(s => (
                                      <DropdownMenuItem 
                                        key={s.code} 
                                        onClick={() => updateStatut(proc, s.code)}
                                        className={proc.statut === s.code ? 'bg-secondary' : ''}
                                      >
                                        <span className={`w-2 h-2 rounded-full mr-2 ${s.dotColor}`}></span>
                                        {s.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditModal(proc)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Modifier
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleDelete(proc.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Supprimer
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Vue par Poste */}
        <TabsContent value="postes" className="mt-6">
          {postesWithProcess.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Aucun process en cours</p>
                <p className="text-sm">Créez des process depuis la page Matching</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Liste des postes */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Postes ({postesWithProcess.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <div className="p-2 space-y-1">
                      {postesWithProcess.map((poste) => {
                        const posteProcesses = getProcessesByPoste(poste.id);
                        const activeCount = posteProcesses.filter(p => !['PCLT', 'REFUS', 'NOGO_DISPO'].includes(p.statut)).length;
                        
                        return (
                          <button
                            key={poste.id}
                            onClick={() => setSelectedPoste(poste)}
                            className={`w-full text-left p-4 rounded-lg border transition-all ${
                              selectedPoste?.id === poste.id
                                ? 'border-primary bg-primary/5'
                                : 'border-transparent hover:bg-secondary'
                            }`}
                            data-testid={`select-poste-process-${poste.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                  poste.convention_signee ? 'bg-green-100' : 'bg-orange-100'
                                }`}>
                                  <Building className={`h-5 w-5 ${
                                    poste.convention_signee ? 'text-green-600' : 'text-orange-600'
                                  }`} />
                                </div>
                                <div>
                                  <p className="font-medium">{poste.titre_poste}</p>
                                  <p className="text-xs text-muted-foreground">{poste.entreprise} • {poste.ville}</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  {posteProcesses.length} candidat{posteProcesses.length > 1 ? 's' : ''}
                                </Badge>
                                {activeCount > 0 && (
                                  <span className="text-xs text-blue-600">{activeCount} actif{activeCount > 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Détails des candidats pour le poste */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Candidats envoyés pour {selectedPoste?.titre_poste}
                  </CardTitle>
                  {selectedPoste && (
                    <p className="text-sm text-muted-foreground">
                      {selectedPoste.entreprise} • {selectedPoste.ville}
                      {selectedPoste.contact_name && ` • Contact: ${selectedPoste.contact_name}`}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {selectedPoste && getProcessesByPoste(selectedPoste.id).length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <p>Aucun candidat envoyé pour ce poste</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedPoste && getProcessesByPoste(selectedPoste.id).map((proc) => {
                        const statutInfo = getStatutBadge(proc.statut);
                        return (
                          <div
                            key={proc.id}
                            className="p-4 rounded-lg border bg-card hover:shadow-sm transition-all"
                            data-testid={`process-poste-item-${proc.id}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                                  {proc.candidat?.prenom?.charAt(0)}{proc.candidat?.nom?.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold">{proc.candidat?.prenom} {proc.candidat?.nom}</p>
                                  <p className="text-sm text-muted-foreground">{proc.candidat?.titre_poste}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {proc.candidat?.ville} ({proc.candidat?.rayon_km}km)
                                    </span>
                                    {proc.candidat?.disponibilite && (
                                      <>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="text-xs text-muted-foreground">Dispo: {proc.candidat?.disponibilite}</span>
                                      </>
                                    )}
                                  </div>
                                  {proc.notes && (
                                    <p className="text-sm text-muted-foreground mt-2 italic">"{proc.notes}"</p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className={`px-3 py-1.5 rounded-full text-xs font-medium ${statutInfo.color} cursor-pointer hover:opacity-80 transition-opacity`}>
                                      {statutInfo.label}
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {STATUTS.map(s => (
                                      <DropdownMenuItem 
                                        key={s.code} 
                                        onClick={() => updateStatut(proc, s.code)}
                                        className={proc.statut === s.code ? 'bg-secondary' : ''}
                                      >
                                        <span className={`w-2 h-2 rounded-full mr-2 ${s.dotColor}`}></span>
                                        {s.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditModal(proc)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Modifier
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleDelete(proc.id)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Supprimer
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de modification */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-heading">Modifier le process</DialogTitle>
          </DialogHeader>
          {currentProcess && (
            <form onSubmit={handleSubmit}>
              <div className="py-4 space-y-4">
                {/* Résumé du process */}
                <div className="p-3 rounded-lg bg-secondary/50 text-sm">
                  <p><strong>{currentProcess.candidat?.prenom} {currentProcess.candidat?.nom}</strong></p>
                  <p className="text-muted-foreground">→ {currentProcess.poste?.entreprise} ({currentProcess.poste?.titre_poste})</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="statut">Statut</Label>
                  <Select 
                    value={formData.statut} 
                    onValueChange={(value) => setFormData({ ...formData, statut: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUTS.map(s => (
                        <SelectItem key={s.code} value={s.code}>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${s.dotColor}`}></span>
                            {s.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.statut === 'PCLT' && (
                  <div className="space-y-2">
                    <Label htmlFor="honoraire">Montant honoraire (€)</Label>
                    <Input
                      id="honoraire"
                      type="number"
                      min="0"
                      step="100"
                      value={formData.honoraire}
                      onChange={(e) => setFormData({ ...formData, honoraire: e.target.value })}
                      placeholder="Ex: 5000"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                  {submitting ? 'Enregistrement...' : 'Mettre à jour'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
