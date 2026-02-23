import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
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
import { Search, MoreHorizontal, Pencil, Trash2, Download, Briefcase, MapPin, User, Building, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const STATUTS = [
  { code: "ENCV", label: "Envoyé", color: "bg-blue-100 text-blue-700 border-blue-200", dotColor: "bg-blue-500" },
  { code: "ENTC", label: "Entretien", color: "bg-purple-100 text-purple-700 border-purple-200", dotColor: "bg-purple-500" },
  { code: "PROPALE", label: "Proposition", color: "bg-orange-100 text-orange-700 border-orange-200", dotColor: "bg-orange-500" },
  { code: "PCLT", label: "Placé", color: "bg-green-100 text-green-700 border-green-200", dotColor: "bg-green-500" },
  { code: "REFUS", label: "Refus", color: "bg-red-100 text-red-700 border-red-200", dotColor: "bg-red-500" },
  { code: "NOGO", label: "NOGO", color: "bg-gray-200 text-gray-600 border-gray-300", dotColor: "bg-gray-500" }
];

export default function ProcessPage() {
  const { getAuthHeaders } = useAuth();
  const [processes, setProcesses] = useState([]);
  const [candidats, setCandidats] = useState([]);
  const [postes, setPostes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('candidats');
  const [expandedItems, setExpandedItems] = useState({});
  
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
      
      // Ouvrir tous les éléments par défaut
      const expanded = {};
      candidatsRes.data.forEach(c => { expanded[`candidat-${c.id}`] = true; });
      postesRes.data.forEach(p => { expanded[`poste-${p.id}`] = true; });
      setExpandedItems(expanded);
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

  const toggleExpand = (key) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
  ).filter(c => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const candidatProcesses = getProcessesByCandidat(c.id);
    const matchesCandidat = c.nom?.toLowerCase().includes(query) || 
           c.prenom?.toLowerCase().includes(query) ||
           c.titre_poste?.toLowerCase().includes(query);
    const matchesEntreprise = candidatProcesses.some(p => 
      p.poste?.entreprise?.toLowerCase().includes(query)
    );
    return matchesCandidat || matchesEntreprise;
  });

  // Filtrer les postes qui ont au moins un process
  const postesWithProcess = postes.filter(p => 
    processes.some(proc => proc.poste_id === p.id)
  ).filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const posteProcesses = getProcessesByPoste(p.id);
    const matchesPoste = p.titre_poste?.toLowerCase().includes(query) || 
           p.entreprise?.toLowerCase().includes(query) ||
           p.ville?.toLowerCase().includes(query);
    const matchesCandidat = posteProcesses.some(proc => 
      proc.candidat?.nom?.toLowerCase().includes(query) ||
      proc.candidat?.prenom?.toLowerCase().includes(query)
    );
    return matchesPoste || matchesCandidat;
  });

  // Stats
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

      {/* Tabs + Search */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
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
          
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher candidat, entreprise..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Vue par Candidat - Liste dépliable */}
        <TabsContent value="candidats" className="mt-0 space-y-3">
          {candidatsWithProcess.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Aucun process en cours</p>
                <p className="text-sm">Créez des process depuis la page Matching</p>
              </CardContent>
            </Card>
          ) : (
            candidatsWithProcess.map((candidat) => {
              const candidatProcesses = getProcessesByCandidat(candidat.id);
              const isExpanded = expandedItems[`candidat-${candidat.id}`];
              
              return (
                <Card key={candidat.id} className="overflow-hidden">
                  {/* Header cliquable */}
                  <button
                    onClick={() => toggleExpand(`candidat-${candidat.id}`)}
                    className="w-full p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                      {candidat.prenom?.charAt(0)}{candidat.nom?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{candidat.prenom} {candidat.nom}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground text-sm">{candidat.titre_poste}</span>
                        <span className="text-muted-foreground text-sm">• {candidat.ville}</span>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {candidatProcesses.length} envoi{candidatProcesses.length > 1 ? 's' : ''}
                    </Badge>
                  </button>
                  
                  {/* Liste des envois (dépliée) */}
                  {isExpanded && (
                    <div className="border-t bg-secondary/10">
                      {candidatProcesses.map((proc, idx) => {
                        const statutInfo = getStatutBadge(proc.statut);
                        return (
                          <div 
                            key={proc.id} 
                            className={`p-4 pl-16 flex items-center gap-4 hover:bg-secondary/20 transition-colors ${
                              idx !== candidatProcesses.length - 1 ? 'border-b border-dashed' : ''
                            }`}
                          >
                            <div className={`h-8 w-8 rounded flex items-center justify-center flex-shrink-0 ${
                              proc.poste?.convention_signee ? 'bg-green-100' : 'bg-orange-100'
                            }`}>
                              <Building className={`h-4 w-4 ${
                                proc.poste?.convention_signee ? 'text-green-600' : 'text-orange-600'
                              }`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{proc.poste?.entreprise}</span>
                                <span className="text-muted-foreground text-sm">- {proc.poste?.titre_poste}</span>
                                <span className="text-muted-foreground text-xs">({proc.poste?.ville})</span>
                              </div>
                              {proc.notes && (
                                <p className="text-xs text-muted-foreground mt-0.5 italic truncate">"{proc.notes}"</p>
                              )}
                            </div>
                            
                            {/* Statut cliquable */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className={`px-3 py-1 rounded-full text-xs font-medium border ${statutInfo.color} cursor-pointer hover:opacity-80`}>
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
                            
                            {/* Menu actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
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
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Vue par Poste - Liste dépliable */}
        <TabsContent value="postes" className="mt-0 space-y-3">
          {postesWithProcess.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Aucun process en cours</p>
                <p className="text-sm">Créez des process depuis la page Matching</p>
              </CardContent>
            </Card>
          ) : (
            postesWithProcess.map((poste) => {
              const posteProcesses = getProcessesByPoste(poste.id);
              const isExpanded = expandedItems[`poste-${poste.id}`];
              
              return (
                <Card key={poste.id} className="overflow-hidden">
                  {/* Header cliquable */}
                  <button
                    onClick={() => toggleExpand(`poste-${poste.id}`)}
                    className="w-full p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      poste.convention_signee ? 'bg-green-100' : 'bg-orange-100'
                    }`}>
                      <Building className={`h-5 w-5 ${
                        poste.convention_signee ? 'text-green-600' : 'text-orange-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{poste.entreprise}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground text-sm">{poste.titre_poste}</span>
                        <span className="text-muted-foreground text-sm">• {poste.ville}</span>
                        {poste.convention_signee && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                            Convention OK
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {posteProcesses.length} candidat{posteProcesses.length > 1 ? 's' : ''}
                    </Badge>
                  </button>
                  
                  {/* Liste des candidats (dépliée) */}
                  {isExpanded && (
                    <div className="border-t bg-secondary/10">
                      {posteProcesses.map((proc, idx) => {
                        const statutInfo = getStatutBadge(proc.statut);
                        return (
                          <div 
                            key={proc.id} 
                            className={`p-4 pl-16 flex items-center gap-4 hover:bg-secondary/20 transition-colors ${
                              idx !== posteProcesses.length - 1 ? 'border-b border-dashed' : ''
                            }`}
                          >
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm flex-shrink-0">
                              {proc.candidat?.prenom?.charAt(0)}{proc.candidat?.nom?.charAt(0)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{proc.candidat?.prenom} {proc.candidat?.nom}</span>
                                <span className="text-muted-foreground text-sm">- {proc.candidat?.titre_poste}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>{proc.candidat?.ville} ({proc.candidat?.rayon_km}km)</span>
                                {proc.candidat?.disponibilite && (
                                  <>
                                    <span>•</span>
                                    <span>Dispo: {proc.candidat?.disponibilite}</span>
                                  </>
                                )}
                              </div>
                              {proc.notes && (
                                <p className="text-xs text-muted-foreground mt-0.5 italic truncate">"{proc.notes}"</p>
                              )}
                            </div>
                            
                            {/* Statut cliquable */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className={`px-3 py-1 rounded-full text-xs font-medium border ${statutInfo.color} cursor-pointer hover:opacity-80`}>
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
                            
                            {/* Menu actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
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
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })
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
