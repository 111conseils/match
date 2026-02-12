import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Euro, Users, Award } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const COLORS = ['#F97316', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1'];

export default function SourcesPage() {
  const { getAuthHeaders } = useAuth();
  const [sourcesData, setSourcesData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/stats/sources`, { 
          headers: getAuthHeaders() 
        });
        setSourcesData(response.data);
      } catch (error) {
        console.error('Error fetching sources stats:', error);
        toast.error('Erreur lors du chargement des statistiques');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getAuthHeaders]);

  const totalCandidats = sourcesData.reduce((sum, s) => sum + s.total, 0);
  const totalPlaces = sourcesData.reduce((sum, s) => sum + s.places, 0);
  const totalHonoraires = sourcesData.reduce((sum, s) => sum + s.honoraires, 0);
  const bestSource = sourcesData.length > 0 ? sourcesData[0] : null;

  const chartData = sourcesData.map((s, index) => ({
    name: s.source.length > 15 ? s.source.substring(0, 15) + '...' : s.source,
    fullName: s.source,
    honoraires: s.honoraires,
    places: s.places,
    total: s.total,
    fill: COLORS[index % COLORS.length]
  }));

  if (loading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="sources-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-heading text-primary tracking-tight">
          Analyse des Sources
        </h1>
        <p className="text-muted-foreground mt-1">
          D'où viennent vos meilleurs candidats ?
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total candidats</p>
                <p className="text-3xl font-bold font-heading mt-1">{totalCandidats}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Placés</p>
                <p className="text-3xl font-bold font-heading mt-1">{totalPlaces}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Honoraires totaux</p>
                <p className="text-3xl font-bold font-heading mt-1">{totalHonoraires.toLocaleString('fr-FR')}€</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-50 flex items-center justify-center">
                <Euro className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Meilleure source</p>
                <p className="text-lg font-bold font-heading mt-1 truncate">
                  {bestSource ? bestSource.source : '-'}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-50 flex items-center justify-center">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Honoraires par source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={(v) => `${v.toLocaleString()}€`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value) => [`${value.toLocaleString('fr-FR')}€`, 'Honoraires']}
                    labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                  />
                  <Bar dataKey="honoraires" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Détail par source</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sourcesData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Aucune donnée disponible</p>
              <p className="text-sm">Ajoutez des candidats avec leur source pour voir les statistiques</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-center">Candidats</TableHead>
                  <TableHead className="text-center">Placés</TableHead>
                  <TableHead className="text-center">Taux conversion</TableHead>
                  <TableHead className="text-right">Honoraires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourcesData.map((source, index) => (
                  <TableRow key={source.source}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{source.source}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{source.total}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={source.places > 0 ? "default" : "secondary"}>
                        {source.places}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {source.total > 0 
                        ? `${Math.round((source.places / source.total) * 100)}%`
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {source.honoraires > 0 ? (
                        <span className="text-green-600">
                          {source.honoraires.toLocaleString('fr-FR')}€
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
