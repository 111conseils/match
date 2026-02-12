import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ArrowRight, Euro, Building, User } from 'lucide-react';
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

export default function ProcessPage() {
  const { getAuthHeaders } = useAuth();
  const [processes, setProcesses] = useState([]);
  const [candidats, setCandidats] = useState([]);
  const [postes, setPostes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatut, setFilterStatut] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProcess, setCurrentProcess] = useState(null);
  const [formData, setFormData] = useState({
    candidat_id: '',
    poste_id: '',
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
      setCandidats(candidatsRes.data);
      setPostes(postesRes.data);
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

  const openCreateModal = () => {
    setFormData({
      candidat_id: '',
      poste_id: '',
      statut: 'ENCV',
      honoraire: '',
      notes: ''
    });
    setIsEditing(false);
    setCurrentProcess(null);
    setIsModalOpen(true);
  };

  const openEditModal = (proc) => {
    setFormData({
      candidat_id: proc.candidat_id,
      poste_id: proc.poste_id,
      statut: proc.statut,
      honoraire: proc.honoraire || '',
      notes: proc.notes || ''
    });
    setIsEditing(true);
    setCurrentProcess(proc);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const dataToSend = {
      ...formData,
      honoraire: formData.honoraire ? parseFloat(formData.honoraire) : null
    };

    try {
      if (isEditing && currentProcess) {
        await axios.put(
          `${API_URL}/api/process/${currentProcess.id}`,
          { statut: dataToSend.statut, honoraire: dataToSend.honoraire, notes: dataToSend.notes },
          { headers: getAuthHeaders() }
        );
        toast.success('Process mis à jour');
      } else {
        await axios.post(
          `${API_URL}/api/process`,
          dataToSend,
          { headers: getAuthHeaders() }
        );
        toast.success('Process créé');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving process:', error);
      const message = error.response?.data?.detail || 'Erreur lors de l\'enregistrement';
      toast.error(message);
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
    const s = STATUTS.find(st => st.code === statut) || STATUTS[0];
    return s;
  };

  const filteredProcesses = processes.filter(p => {
    const query = searchQuery.toLowerCase();
    const candidat = p.candidat;
    const poste = p.poste;
    const matchesSearch = (
      (candidat?.nom?.toLowerCase().includes(query)) ||
      (candidat?.prenom?.toLowerCase().includes(query)) ||
      (poste?.entreprise?.toLowerCase().includes(query)) ||
      (poste?.titre_poste?.toLowerCase().includes(query))
    );
    const matchesStatut = filterStatut === 'ALL' || p.statut === filterStatut;
    return matchesSearch && matchesStatut;
  });

  // Calculer les stats
  const totalProcess = processes.length;
  const placesCount = processes.filter(p => p.statut === 'PCLT').length;
  const totalHonoraires = processes
    .filter(p => p.statut === 'PCLT' && p.honoraire)
    .reduce((sum, p) => sum + p.honoraire, 0);

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
          <p className="text-muted-foreground mt-1">
            {totalProcess} process • {placesCount} placés • {totalHonoraires.toLocaleString('fr-FR')}€ d'honoraires
          </p>
        </div>
        <Button onClick={openCreateModal} data-testid="add-process-btn">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau process
        </Button>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par candidat ou entreprise..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-process-input"
              />
            </div>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="filter-statut">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                {STATUTS.map(s => (
                  <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredProcesses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowRight className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Aucun process trouvé</p>
              <p className="text-sm">
                {searchQuery || filterStatut !== 'ALL' 
                  ? 'Essayez une autre recherche' 
                  : 'Créez un process depuis la page Matching'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidat</TableHead>
                    <TableHead className="text-center">
                      <ArrowRight className="h-4 w-4 mx-auto" />
                    </TableHead>
                    <TableHead>Poste / Entreprise</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Honoraire</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProcesses.map((proc) => {
                    const statutInfo = getStatutBadge(proc.statut);
                    return (
                      <TableRow key={proc.id} data-testid={`process-row-${proc.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-medium">
                              {proc.candidat?.prenom?.charAt(0)}{proc.candidat?.nom?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{proc.candidat?.prenom} {proc.candidat?.nom}</p>
                              <p className="text-xs text-muted-foreground">{proc.candidat?.titre_poste}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                              <Building className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium">{proc.poste?.titre_poste}</p>
                              <p className="text-xs text-muted-foreground">{proc.poste?.entreprise} • {proc.poste?.ville}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`px-2 py-1 rounded-full text-xs font-medium ${statutInfo.color} cursor-pointer hover:opacity-80`}>
                                {statutInfo.label}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {STATUTS.map(s => (
                                <DropdownMenuItem 
                                  key={s.code} 
                                  onClick={() => updateStatut(proc, s.code)}
                                  className={proc.statut === s.code ? 'bg-secondary' : ''}
                                >
                                  <span className={`w-2 h-2 rounded-full mr-2 ${s.color.split(' ')[0]}`}></span>
                                  {s.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          {proc.statut === 'PCLT' && proc.honoraire ? (
                            <div className="flex items-center gap-1 text-green-600 font-medium">
                              <Euro className="h-4 w-4" />
                              {proc.honoraire.toLocaleString('fr-FR')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                            {proc.notes || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`process-actions-${proc.id}`}>
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {isEditing ? 'Modifier le process' : 'Nouveau process'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {!isEditing && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="candidat">Candidat</Label>
                    <Select 
                      value={formData.candidat_id} 
                      onValueChange={(value) => setFormData({ ...formData, candidat_id: value })}
                    >
                      <SelectTrigger data-testid="process-candidat-select">
                        <SelectValue placeholder="Sélectionner un candidat" />
                      </SelectTrigger>
                      <SelectContent>
                        {candidats.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.prenom} {c.nom} - {c.titre_poste}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="poste">Poste</Label>
                    <Select 
                      value={formData.poste_id} 
                      onValueChange={(value) => setFormData({ ...formData, poste_id: value })}
                    >
                      <SelectTrigger data-testid="process-poste-select">
                        <SelectValue placeholder="Sélectionner un poste" />
                      </SelectTrigger>
                      <SelectContent>
                        {postes.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.titre_poste} - {p.entreprise} ({p.ville})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="statut">Statut</Label>
                <Select 
                  value={formData.statut} 
                  onValueChange={(value) => setFormData({ ...formData, statut: value })}
                >
                  <SelectTrigger data-testid="process-statut-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUTS.map(s => (
                      <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
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
                    data-testid="process-honoraire-input"
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
                  data-testid="process-notes-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting} data-testid="process-submit-btn">
                {submitting ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Créer')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
