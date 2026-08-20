import { useState, useEffect, useCallback } from 'react';
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
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, MapPin, Briefcase, Building, FileCheck, FileX, Download, Upload, Mail } from 'lucide-react';
import { toast } from 'sonner';
import TablePagination from '../components/TablePagination';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Le backend ne plafonne plus les listes : on pagine côté affichage.
const PAGE_SIZE = 50;

const initialFormState = {
  entreprise: '',
  titre_poste: '',
  ville: '',
  code_postal: '',
  convention_signee: false,
  contact: '',
  email_contact: ''
};

export default function PostesPage() {
  const { getAuthHeaders, handleUnauthorized } = useAuth();
  const [postes, setPostes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterConvention, setFilterConvention] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPoste, setCurrentPoste] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);

  const fetchPostes = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/postes`, { 
        headers: getAuthHeaders() 
      });
      setPostes(response.data);
    } catch (error) {
      console.error('Error fetching postes:', error);
      if (error.response?.status !== 401) {
        toast.error('Erreur lors du chargement des postes');
      }
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchPostes();
  }, [fetchPostes]);

  // Revenir en page 1 quand le filtrage change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterConvention]);

  const openCreateModal = () => {
    setFormData(initialFormState);
    setIsEditing(false);
    setCurrentPoste(null);
    setIsModalOpen(true);
  };

  const openEditModal = (poste) => {
    setFormData({
      entreprise: poste.entreprise,
      titre_poste: poste.titre_poste,
      ville: poste.ville,
      code_postal: poste.code_postal || '',
      convention_signee: poste.convention_signee || false,
      contact: poste.contact || '',
      email_contact: poste.email_contact || ''
    });
    setIsEditing(true);
    setCurrentPoste(poste);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isEditing && currentPoste) {
        await axios.put(
          `${API_URL}/api/postes/${currentPoste.id}`,
          formData,
          { headers: getAuthHeaders() }
        );
        toast.success('Poste mis à jour');
      } else {
        await axios.post(
          `${API_URL}/api/postes`,
          formData,
          { headers: getAuthHeaders() }
        );
        toast.success('Poste ajouté');
      }
      setIsModalOpen(false);
      fetchPostes();
    } catch (error) {
      console.error('Error saving poste:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce poste ?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/postes/${id}`, { 
        headers: getAuthHeaders() 
      });
      toast.success('Poste supprimé');
      fetchPostes();
    } catch (error) {
      console.error('Error deleting poste:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  const toggleConvention = async (poste) => {
    try {
      await axios.put(
        `${API_URL}/api/postes/${poste.id}`,
        { convention_signee: !poste.convention_signee },
        { headers: getAuthHeaders() }
      );
      toast.success(poste.convention_signee ? 'Convention retirée' : 'Convention validée');
      fetchPostes();
    } catch (error) {
      console.error('Error toggling convention:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const filteredPostes = postes.filter(p => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      p.entreprise.toLowerCase().includes(query) ||
      p.titre_poste.toLowerCase().includes(query) ||
      p.ville.toLowerCase().includes(query)
    );
    const matchesConvention = filterConvention === 'ALL' || 
      (filterConvention === 'SIGNED' && p.convention_signee) ||
      (filterConvention === 'NOT_SIGNED' && !p.convention_signee);
    return matchesSearch && matchesConvention;
  });

  const totalPages = Math.max(1, Math.ceil(filteredPostes.length / PAGE_SIZE));
  const pageCourante = Math.min(page, totalPages);
  const postesAffiches = filteredPostes.slice(
    (pageCourante - 1) * PAGE_SIZE,
    pageCourante * PAGE_SIZE
  );

  const signedCount = postes.filter(p => p.convention_signee).length;
  const notSignedCount = postes.filter(p => !p.convention_signee).length;

  const handleExport = async () => {
    try {
      const response = await fetch(`${API_URL}/api/export/postes`, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `postes_${new Date().toISOString().slice(0,10)}.xlsx`;
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
      const response = await fetch(`${API_URL}/api/import/postes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        // Le backend déduplique : un poste déjà connu est mis à jour, pas recréé.
        const ajoutes = result.imported || 0;
        const majs = result.updated || 0;
        if (ajoutes && majs) {
          toast.success(`${ajoutes} poste(s) ajouté(s), ${majs} mis à jour`);
        } else if (majs) {
          toast.success(`${majs} poste(s) déjà connu(s) mis à jour`);
        } else {
          toast.success(`${ajoutes} poste(s) ajouté(s) !`);
        }
        if (result.errors?.length > 0) {
          toast.warning(`${result.errors.length} ligne(s) en erreur : ${result.errors[0]}`);
        }
        fetchPostes();
      } else if (response.status === 401) {
        handleUnauthorized();
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

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="postes-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading text-primary tracking-tight">
            Postes
          </h1>
          <p className="text-muted-foreground mt-1">
            {postes.length} poste{postes.length > 1 ? 's' : ''} • 
            <span className="text-green-600 ml-1">{signedCount} convention{signedCount > 1 ? 's' : ''}</span> • 
            <span className="text-orange-600 ml-1">{notSignedCount} sans convention</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} data-testid="export-postes-btn">
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
              data-testid="import-postes-input"
            />
          </label>
          <Button onClick={openCreateModal} data-testid="add-poste-btn">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par entreprise, poste ou ville..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-postes-input"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant={filterConvention === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterConvention('ALL')}
              >
                Tous
              </Button>
              <Button 
                variant={filterConvention === 'SIGNED' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterConvention('SIGNED')}
                className={filterConvention === 'SIGNED' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                <FileCheck className="h-4 w-4 mr-1" />
                Convention
              </Button>
              <Button 
                variant={filterConvention === 'NOT_SIGNED' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterConvention('NOT_SIGNED')}
                className={filterConvention === 'NOT_SIGNED' ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                <FileX className="h-4 w-4 mr-1" />
                Sans convention
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filteredPostes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Aucun poste trouvé</p>
              <p className="text-sm">
                {searchQuery || filterConvention !== 'ALL' ? 'Essayez une autre recherche' : 'Ajoutez votre premier poste'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Convention</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {postesAffiches.map((poste) => (
                    <TableRow 
                      key={poste.id} 
                      data-testid={`poste-row-${poste.id}`}
                      className={poste.convention_signee ? 'bg-green-50/50' : 'bg-orange-50/30'}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            poste.convention_signee 
                              ? 'bg-green-100' 
                              : 'bg-orange-100'
                          }`}>
                            <Building className={`h-5 w-5 ${
                              poste.convention_signee 
                                ? 'text-green-600' 
                                : 'text-orange-600'
                            }`} />
                          </div>
                          <span className="font-medium">{poste.entreprise}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{poste.titre_poste}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{poste.ville}</span>
                          {poste.code_postal && <span className="text-xs">({poste.code_postal})</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {poste.contact || poste.email_contact ? (
                          <div className="text-sm">
                            {poste.contact && <p className="font-medium">{poste.contact}</p>}
                            {poste.email_contact && (
                              <a 
                                href={`mailto:${poste.email_contact}`} 
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Mail className="h-3 w-3" />
                                {poste.email_contact}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleConvention(poste)}
                          className="flex items-center gap-2 cursor-pointer"
                          data-testid={`toggle-convention-${poste.id}`}
                        >
                          {poste.convention_signee ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
                              <FileCheck className="h-3 w-3 mr-1" />
                              Signée
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-orange-300 text-orange-600 hover:bg-orange-50">
                              <FileX className="h-3 w-3 mr-1" />
                              Non signée
                            </Badge>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`poste-actions-${poste.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(poste)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(poste.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination
                page={pageCourante}
                pageSize={PAGE_SIZE}
                totalItems={filteredPostes.length}
                onPageChange={setPage}
                label="poste"
                testId="postes-pagination"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {isEditing ? 'Modifier le poste' : 'Ajouter un poste'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="entreprise">Entreprise</Label>
                <Input
                  id="entreprise"
                  value={formData.entreprise}
                  onChange={(e) => setFormData({ ...formData, entreprise: e.target.value })}
                  placeholder="Ex: TechCorp"
                  required
                  data-testid="poste-entreprise-input"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="titre_poste">Intitulé du poste</Label>
                <Input
                  id="titre_poste"
                  value={formData.titre_poste}
                  onChange={(e) => setFormData({ ...formData, titre_poste: e.target.value })}
                  placeholder="Ex: Développeur Web"
                  required
                  data-testid="poste-titre-input"
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
                    data-testid="poste-ville-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code_postal">Code postal</Label>
                  <Input
                    id="code_postal"
                    value={formData.code_postal}
                    onChange={(e) => setFormData({ ...formData, code_postal: e.target.value })}
                    placeholder="Ex: 33000"
                    data-testid="poste-cp-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact">Nom du contact</Label>
                  <Input
                    id="contact"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    placeholder="Ex: Marie Dupont"
                    data-testid="poste-contact-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email_contact">Email du contact</Label>
                  <Input
                    id="email_contact"
                    type="email"
                    value={formData.email_contact}
                    onChange={(e) => setFormData({ ...formData, email_contact: e.target.value })}
                    placeholder="Ex: contact@entreprise.fr"
                    data-testid="poste-email-input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="space-y-0.5">
                  <Label htmlFor="convention" className="text-base">Convention signée</Label>
                  <p className="text-sm text-muted-foreground">
                    {formData.convention_signee 
                      ? 'Vous pouvez envoyer les CV nominatifs' 
                      : 'Envoyez les CV en anonyme'}
                  </p>
                </div>
                <Switch
                  id="convention"
                  checked={formData.convention_signee}
                  onCheckedChange={(checked) => setFormData({ ...formData, convention_signee: checked })}
                  data-testid="poste-convention-switch"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting} data-testid="poste-submit-btn">
                {submitting ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Ajouter')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
