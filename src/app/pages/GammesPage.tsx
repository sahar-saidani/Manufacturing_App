import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { ArrowRight, Package } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { apiService } from '../services/api';

export function GammesPage() {
  const { loading, analytics } = useAppData();

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Chargement des gammes...</div>;
  }

  if (!analytics) {
    return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-gray-500">Aucune gamme disponible.</div>;
  }

  const gammes = apiService.groupProductsAsGammes(analytics.products, analytics.machines);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Gammes de fabrication</h2>
        <p className="mt-1 text-gray-600">Séquences d'opérations par produit</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Liste des gammes ({gammes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Référence</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead>Demande annuelle</TableHead>
                <TableHead>Gamme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gammes.map((gamme) => (
                <TableRow key={gamme.product.id}>
                  <TableCell className="font-mono font-medium">{gamme.product.reference}</TableCell>
                  <TableCell>{gamme.product.name}</TableCell>
                  <TableCell>{gamme.product.batch_size}</TableCell>
                  <TableCell>{gamme.product.annual_demand}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {gamme.operations.map((operation, index) => (
                        <div key={`${gamme.product.id}-${operation.sequence}`} className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {operation.machine?.code}
                          </Badge>
                          {index < gamme.operations.length - 1 && <ArrowRight className="h-3 w-3 text-gray-400" />}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {gammes.map((gamme) => (
          <Card key={gamme.product.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {gamme.product.reference} · {gamme.product.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Taille de lot</span>
                <span className="font-medium">{gamme.product.batch_size}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Demande annuelle</span>
                <span className="font-medium">{gamme.product.annual_demand}</span>
              </div>
              <div className="border-t pt-3">
                <div className="mb-2 text-sm font-medium text-gray-700">Opérations</div>
                <div className="space-y-2">
                  {gamme.operations.map((operation) => (
                    <div key={`${gamme.product.id}-${operation.sequence}`} className="rounded bg-gray-50 p-3">
                      <div className="font-medium text-sm">
                        {operation.sequence}. {operation.machine?.code} - {operation.machine?.name}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {operation.operation_name || 'Opération'}
                        {operation.operation_time ? ` · ${operation.operation_time} min` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
