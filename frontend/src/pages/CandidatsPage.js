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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, MapPin, User, Euro } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const STATUTS = [
  { code: "NOUVEAU", label: "Nouveau", color: "bg-gray-100 text-gray-700" },
  { code: "ENCV", label: "Envoyé au client", color: "bg-blue-100 text-blue-700" },
  { code: "ENTC", label: "Entretien client", color: "bg-purple-100 text-purple-700" },
  { code: "PROPALE", label: "Sous proposition", color: "bg-orange-100 text-orange-700" },
  { code: "PCLT", label: "Placé", color: "bg-green-100 text-green-700" },
  { code: "REFUS", label: "Refus propale", color: "bg-red-100 text-red-700" },
  { code: "NOGO_DISPO", label: "Plus disponible", color: "bg-gray-200 text-gray-600" }
];

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
  rayon_km: 30,
  titre_poste: '',
  remuneration: '',
  disponibilite: '',
  statut: 'NOUVEAU',
  honoraire: '',
  source: ''
};

export default function CandidatsPage() {
  const { getAuthHeaders } = useAuth();
  const [candidats, setCandidats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatut, setFilterStatut] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCandidat, setCurrentCandidat] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  const fetchCandidats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/candidats`, { 
        headers: getAuthHeaders() 
      });
      setCandidats(response.data);
    } catch (error) {
      console.error('Error fetching candidats:', error);
      toast.error('Erreur lors du chargement des candidats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidats();
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
      rayon_km: candidat.rayon_km,
      titre_poste: candidat.titre_poste,
      remuneration: candidat.remuneration || '',
      disponibilite: candidat.disponibilite || '',
      statut: candidat.statut || 'NOUVEAU',
      honoraire: candidat.honoraire || '',
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
      honoraire: formData.honoraire ? parseFloat(formData.honoraire) : null,
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
      fetchCandidats();
    } catch (error) {
      console.error('Error saving candidat:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce candidat ?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/candidats/${id}`, { 
        headers: getAuthHeaders() 
      });
      toast.success('Candidat supprimé');
      fetchCandidats();
    } catch (error) {
      console.error('Error deleting candidat:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const updateStatut = async (candidat, newStatut) => {
    try {
      await axios.put(
        `${API_URL}/api/candidats/${candidat.id}`,
        { statut: newStatut },
        { headers: getAuthHeaders() }
      );
      toast.success('Statut mis à jour');
      fetchCandidats();
    } catch (error) {
      console.error('Error updating statut:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const getStatutBadge = (statut) => {
    const s = STATUTS.find(st => st.code === statut) || STATUTS[0];
    return s;
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
    const matchesStatut = filterStatut === 'ALL' || c.statut === filterStatut;
    return matchesSearch && matchesStatut;
  });

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
        <Button onClick={openCreateModal} data-testid="add-candidat-btn">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un candidat
        </Button>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
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
          {filteredCandidats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Aucun candidat trouvé</p>
              <p className="text-sm">
                {searchQuery || filterStatut !== 'ALL' ? 'Essayez une autre recherche' : 'Ajoutez votre premier candidat'}
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
                    <TableHead>Statut</TableHead>
                    <TableHead>Honoraire</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidats.map((candidat) => {
                    const statutInfo = getStatutBadge(candidat.statut);
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
                            <span className="text-sm">{candidat.source}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
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
                                  onClick={() => updateStatut(candidat, s.code)}
                                  className={candidat.statut === s.code ? 'bg-secondary' : ''}
                                >
                                  <span className={`w-2 h-2 rounded-full mr-2 ${s.color.split(' ')[0]}`}></span>
                                  {s.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          {candidat.statut === 'PCLT' && candidat.honoraire ? (
                            <div className="flex items-center gap-1 text-green-600 font-medium">
                              <Euro className="h-4 w-4" />
                              {candidat.honoraire.toLocaleString('fr-FR')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
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
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="border-t pt-4 mt-2">
                <p className="text-sm font-medium text-muted-foreground mb-3">Suivi & Source</p>
                
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="statut">Statut</Label>
                    <Select 
                      value={formData.statut} 
                      onValueChange={(value) => setFormData({ ...formData, statut: value })}
                    >
                      <SelectTrigger data-testid="candidat-statut-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUTS.map(s => (
                          <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.statut === 'PCLT' && (
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="honoraire">Montant honoraire (€)</Label>
                    <Input
                      id="honoraire"
                      type="number"
                      min="0"
                      step="100"
                      value={formData.honoraire}
                      onChange={(e) => setFormData({ ...formData, honoraire: e.target.value })}
                      placeholder="Ex: 5000"
                      data-testid="candidat-honoraire-input"
                    />
                  </div>
                )}
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
