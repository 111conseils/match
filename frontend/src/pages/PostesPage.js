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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, MapPin, Briefcase, Building } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const initialFormState = {
  entreprise: '',
  titre_poste: '',
  ville: ''
};

export default function PostesPage() {
  const { getAuthHeaders } = useAuth();
  const [postes, setPostes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPoste, setCurrentPoste] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  const fetchPostes = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/postes`, { 
        headers: getAuthHeaders() 
      });
      setPostes(response.data);
    } catch (error) {
      console.error('Error fetching postes:', error);
      toast.error('Erreur lors du chargement des postes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostes();
  }, []);

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
      ville: poste.ville
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

  const filteredPostes = postes.filter(p => {
    const query = searchQuery.toLowerCase();
    return (
      p.entreprise.toLowerCase().includes(query) ||
      p.titre_poste.toLowerCase().includes(query) ||
      p.ville.toLowerCase().includes(query)
    );
  });

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
            {postes.length} poste{postes.length > 1 ? 's' : ''} à pourvoir
          </p>
        </div>
        <Button onClick={openCreateModal} data-testid="add-poste-btn">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un poste
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par entreprise, poste ou ville..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-postes-input"
            />
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
                {searchQuery ? 'Essayez une autre recherche' : 'Ajoutez votre premier poste'}
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
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPostes.map((poste) => (
                    <TableRow key={poste.id} data-testid={`poste-row-${poste.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                            <Building className="h-5 w-5 text-green-600" />
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
                        </div>
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
