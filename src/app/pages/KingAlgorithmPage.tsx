import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Play } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { apiService } from '../services/api';

export function KingAlgorithmPage() {
  const { activeCompanyId, analytics, refreshData, loading } = useAppData();
  const [running, setRunning] = useState(false);
  const [latestResult, setLatestResult] = useState(analytics?.latest_analysis ?? null);

  useEffect(() => {
    setLatestResult(analytics?.latest_analysis ?? null);
  }, [analytics?.latest_analysis]);

  const result = latestResult ?? analytics?.latest_analysis ?? null;

  const runAlgorithm = async () => {
    if (!activeCompanyId) {
      return;
    }

    setRunning(true);
    try {
      const payload = await apiService.runKingAlgorithm(activeCompanyId);
      setLatestResult(payload);
      await refreshData();
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Chargement du résultat...</div>;
  }

  if (!analytics) {
    return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-gray-500">Aucune donnée disponible.</div>;
  }

  const cells = apiService.buildCells(result, analytics.machines);
  const transposedMatrix =
    result?.ordered_matrix[0]?.length
      ? result.product_order.map((productReference, productIndex) => ({
          productReference,
          values: result.machine_order.map((_, machineIndex) => result.ordered_matrix[machineIndex][productIndex]),
        }))
      : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Résultat de la méthode de King</h2>
          <p className="mt-1 text-gray-600">Une seule matrice finale produit/machine et les îlots formés</p>
        </div>
        <Button onClick={() => void runAlgorithm()} disabled={running || !activeCompanyId}>
          <Play className="mr-2 h-4 w-4" />
          {running ? 'Exécution...' : "Lancer l'algorithme"}
        </Button>
      </div>

      {result ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Matrice finale Produit / Machine</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border bg-gray-100 p-2 text-left">Produit</th>
                    {result.machine_order.map((machineCode) => (
                      <th key={machineCode} className="border bg-gray-100 p-2 font-mono">
                        {machineCode}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transposedMatrix.map((row, rowIndex) => (
                    <tr key={`${row.productReference}-${rowIndex}`}>
                      <td className="border bg-gray-50 p-2 font-mono font-semibold">{row.productReference}</td>
                      {row.values.map((value, columnIndex) => {
                        const isInsideCell = cells.some((cell) => {
                          return (
                            rowIndex >= cell.column_start &&
                            rowIndex <= cell.column_end &&
                            columnIndex >= cell.row_start &&
                            columnIndex <= cell.row_end
                          );
                        });

                        return (
                          <td
                            key={`${row.productReference}-${columnIndex}`}
                            className="border p-2 text-center font-semibold"
                            style={{
                              backgroundColor: value === 1 ? (isInsideCell ? '#111827' : '#dc2626') : 'white',
                              color: value === 1 ? 'white' : '#9ca3af',
                            }}
                          >
                            {value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Îlots formés</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cells.length ? (
                cells.map((cell) => {
                  const productNames = result.product_order.slice(cell.column_start, cell.column_end + 1);
                  const machineNames = result.machine_order.slice(cell.row_start, cell.row_end + 1);

                  return (
                    <div key={cell.id} className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cell.color }} />
                        <h3 className="font-semibold text-gray-900">{cell.code}</h3>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div>
                          <div className="mb-2 font-medium text-gray-700">Machines</div>
                          <div className="flex flex-wrap gap-2">
                            {machineNames.map((machineCode) => (
                              <Badge key={machineCode} style={{ backgroundColor: cell.color, color: 'white' }}>
                                {machineCode}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 font-medium text-gray-700">Produits</div>
                          <div className="flex flex-wrap gap-2">
                            {productNames.map((productReference) => (
                              <Badge key={productReference} variant="outline">
                                {productReference}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500">Aucun îlot détecté.</div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">Lance une analyse pour obtenir la matrice finale et les îlots formés.</CardContent>
        </Card>
      )}
    </div>
  );
}
