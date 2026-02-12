import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
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
import { Badge } from '../components/ui/badge';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, MapPin, User, ArrowRight, Download, Upload, Archive, ArchiveRestore } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SOURCES = [
  "Hellowork candidature",
  "Hellowork cvtech",
  "Indeed",
  "LinkedIn",
  "Site 111 conseils",
  "Cooptation"
];

const initialFormState = {
  nom: '',
  prenom: '',
  ville: '',
  code_postal: '',
  rayon_km: 30,
  titre_poste: '',
  remuneration: '',
  disponibilite: '',
  source: ''
};

export default function CandidatsPage() {
  const { getAuthHeaders } = useAuth();
  const [candidats, setCandidats] = useState([]);
  const [processMap, setProcessMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState('ALL');
  const [filterArchived, setFilterArchived] = useState('active'); // 'active', 'archived', 'all'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCandidat, setCurrentCandidat] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [candidatsRes, processRes] = await Promise.all([
        axios.get(`${API_URL}/api/candidats`, { headers: getAuthHeaders() }),
        axios.get(`${API_URL}/api/process`, { headers: getAuthHeaders() })
      ]);
      setCandidats(candidatsRes.data);
      
      // Créer une map des process par candidat_id
      const pMap = {};
      processRes.data.forEach(p => {
        if (!pMap[p.candidat_id]) {
          pMap[p.candidat_id] = [];
        }
        pMap[p.candidat_id].push(p);
      });
      setProcessMap(pMap);
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
    setFormData(initialFormState);
    setIsEditing(false);
    setCurrentCandidat(null);
    setIsModalOpen(true);
  };

  const openEditModal = (candidat) => {
    setFormData({
      nom: candidat.nom,
      prenom: candidat.prenom,
      ville: candidat.ville,
      code_postal: candidat.code_postal || '',
      rayon_km: candidat.rayon_km,
      titre_poste: candidat.titre_poste,
      remuneration: candidat.remuneration || '',
      disponibilite: candidat.disponibilite || '',
      source: candidat.source || ''
    });
    setIsEditing(true);
    setCurrentCandidat(candidat);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const dataToSend = {
      ...formData,
      source: formData.source || null
    };

    try {
      if (isEditing && currentCandidat) {
        await axios.put(
          `${API_URL}/api/candidats/${currentCandidat.id}`,
          dataToSend,
          { headers: getAuthHeaders() }
        );
        toast.success('Candidat mis à jour');
      } else {
        await axios.post(
          `${API_URL}/api/candidats`,
          dataToSend,
          { headers: getAuthHeaders() }
        );
        toast.success('Candidat ajouté');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving candidat:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce candidat et tous ses process ?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/candidats/${id}`, { headers: getAuthHeaders() });
      toast.success('Candidat supprimé');
      fetchData();
    } catch (error) {
      console.error('Error deleting candidat:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleToggleArchive = async (candidat) => {
    const newStatus = !candidat.is_archived;
    try {
      await axios.put(
        `${API_URL}/api/candidats/${candidat.id}`,
        { is_archived: newStatus },
        { headers: getAuthHeaders() }
      );
      toast.success(newStatus ? 'Candidat archivé' : 'Candidat restauré');
      fetchData();
    } catch (error) {
      console.error('Error toggling archive:', error);
      toast.error('Erreur lors de l\'archivage');
    }
  };

  const getProcessCount = (candidatId) => {
    return processMap[candidatId]?.length || 0;
  };

  const getActiveProcesses = (candidatId) => {
    return processMap[candidatId]?.filter(p => !['PCLT', 'REFUS', 'NOGO_DISPO'].includes(p.statut)) || [];
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`${API_URL}/api/export/candidats`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `candidats_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Export téléchargé !');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erreur lors de l\'export');
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_URL}/api/import/candidats`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success(`${result.imported} candidat(s) importé(s) !`);
        if (result.errors?.length > 0) {
          toast.warning(`${result.errors.length} erreur(s) lors de l'import`);
        }
        fetchData();
      } else {
        toast.error(result.detail || 'Erreur lors de l\'import');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erreur lors de l\'import');
    }
    
    // Reset input
    event.target.value = '';
  };

  const filteredCandidats = candidats.filter(c => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      c.nom.toLowerCase().includes(query) ||
      c.prenom.toLowerCase().includes(query) ||
      c.ville.toLowerCase().includes(query) ||
      c.titre_poste.toLowerCase().includes(query) ||
      (c.source && c.source.toLowerCase().includes(query))
    );
    const matchesSource = filterSource === 'ALL' || c.source === filterSource;
    const matchesArchived = filterArchived === 'all' || 
      (filterArchived === 'active' && !c.is_archived) ||
      (filterArchived === 'archived' && c.is_archived);
    return matchesSearch && matchesSource && matchesArchived;
  });

  const activeCount = candidats.filter(c => !c.is_archived).length;
  const archivedCount = candidats.filter(c => c.is_archived).length;

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="candidats-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading text-primary tracking-tight">
            Candidats
          </h1>
          <p className="text-muted-foreground mt-1">
            {candidats.length} candidat{candidats.length > 1 ? 's' : ''} enregistré{candidats.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} data-testid="export-candidats-btn">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Import Excel
              </span>
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
              data-testid="import-candidats-input"
            />
          </label>
          <Button onClick={openCreateModal} data-testid="add-candidat-btn">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Archive filter tabs */}
            <div className="flex gap-2">
              <Button
                variant={filterArchived === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterArchived('active')}
                data-testid="filter-active-btn"
              >
                Actifs ({activeCount})
              </Button>
              <Button
                variant={filterArchived === 'archived' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterArchived('archived')}
                data-testid="filter-archived-btn"
              >
                <Archive className="h-4 w-4 mr-1" />
                Archivés ({archivedCount})
              </Button>
              <Button
                variant={filterArchived === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterArchived('all')}
                data-testid="filter-all-btn"
              >
                Tous ({candidats.length})
              </Button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, ville, poste ou source..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-candidats-input"
                />
              </div>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="w-full sm:w-[200px]" data-testid="filter-source">
                  <SelectValue placeholder="Filtrer par source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les sources</SelectItem>
                  {SOURCES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredCandidats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Aucun candidat trouvé</p>
              <p className="text-sm">
                {searchQuery || filterSource !== 'ALL' ? 'Essayez une autre recherche' : 'Ajoutez votre premier candidat'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidat</TableHead>
                    <TableHead>Poste recherché</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Process actifs</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidats.map((candidat) => {
                    const activeProcesses = getActiveProcesses(candidat.id);
                    const totalProcesses = getProcessCount(candidat.id);
                    
                    return (
                      <TableRow key={candidat.id} data-testid={`candidat-row-${candidat.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                              {candidat.prenom.charAt(0)}{candidat.nom.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium">{candidat.prenom} {candidat.nom}</p>
                              <p className="text-xs text-muted-foreground">
                                {candidat.disponibilite && `Dispo: ${candidat.disponibilite}`}
                                {candidat.remuneration && ` • ${candidat.remuneration}`}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{candidat.titre_poste}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>{candidat.ville}</span>
                            <span className="text-xs">({candidat.rayon_km}km)</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {candidat.source ? (
                            <Badge variant="outline" className="text-xs">
                              {candidat.source}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {totalProcesses > 0 ? (
                            <div className="flex items-center gap-2">
                              <Badge variant={activeProcesses.length > 0 ? "default" : "secondary"}>
                                {activeProcesses.length} actif{activeProcesses.length > 1 ? 's' : ''}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                / {totalProcesses} total
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Aucun</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`candidat-actions-${candidat.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditModal(candidat)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(candidat.id)}
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
              {isEditing ? 'Modifier le candidat' : 'Ajouter un candidat'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom</Label>
                  <Input
                    id="prenom"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    required
                    data-testid="candidat-prenom-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom</Label>
                  <Input
                    id="nom"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    required
                    data-testid="candidat-nom-input"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="titre_poste">Poste recherché</Label>
                <Input
                  id="titre_poste"
                  value={formData.titre_poste}
                  onChange={(e) => setFormData({ ...formData, titre_poste: e.target.value })}
                  placeholder="Ex: Développeur Web"
                  required
                  data-testid="candidat-titre-input"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ville">Ville</Label>
                  <Input
                    id="ville"
                    value={formData.ville}
                    onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                    placeholder="Ex: Bordeaux"
                    required
                    data-testid="candidat-ville-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code_postal">Code postal</Label>
                  <Input
                    id="code_postal"
                    value={formData.code_postal}
                    onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                    placeholder="Ex: 33000"
                    data-testid="candidat-cp-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rayon_km">Rayon (km)</Label>
                  <Input
                    id="rayon_km"
                    type="number"
                    min="1"
                    max="200"
                    value={formData.rayon_km}
                    onChange={(e) => setFormData({ ...formData, rayon_km: parseInt(e.target.value) || 30 })}
                    data-testid="candidat-rayon-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="remuneration">Rémunération souhaitée</Label>
                  <Input
                    id="remuneration"
                    value={formData.remuneration}
                    onChange={(e) => setFormData({ ...formData, remuneration: e.target.value })}
                    placeholder="Ex: 35-40K€"
                    data-testid="candidat-remuneration-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disponibilite">Disponibilité</Label>
                  <Input
                    id="disponibilite"
                    value={formData.disponibilite}
                    onChange={(e) => setFormData({ ...formData, disponibilite: e.target.value })}
                    placeholder="Ex: Immédiate"
                    data-testid="candidat-disponibilite-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Source du candidat</Label>
                <Select 
                  value={formData.source} 
                  onValueChange={(value) => setFormData({ ...formData, source: value })}
                >
                  <SelectTrigger data-testid="candidat-source-select">
                    <SelectValue placeholder="D'où vient-il ?" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(source => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting} data-testid="candidat-submit-btn">
                {submitting ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Ajouter')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
