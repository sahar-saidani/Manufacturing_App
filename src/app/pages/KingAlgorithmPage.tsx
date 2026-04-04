import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Play, CheckCircle, Info } from 'lucide-react';
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
    return <div className="flex h-64 items-center justify-center text-gray-500">Chargement de l'analyse...</div>;
  }

  if (!analytics) {
    return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-gray-500">Aucune donnée disponible.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Algorithme King</h2>
          <p className="mt-1 text-gray-600">Réordonnancement de la matrice d'incidence et détection des cellules</p>
        </div>
        <Button onClick={() => void runAlgorithm()} disabled={running || !activeCompanyId}>
          <Play className="mr-2 h-4 w-4" />
          {running ? 'Exécution...' : "Exécuter l'algorithme"}
        </Button>
      </div>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="text-sm text-blue-900">
              La méthode King trie d'abord les lignes puis les colonnes par poids binaire pour faire émerger des blocs
              diagonaux. Le backend Django persiste le résultat et affecte les machines aux cellules détectées.
            </div>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <MetricCard label="Itérations" value={result.iterations} />
            <MetricCard label="Cellules" value={result.cell_blocks.length} />
            <MetricCard label="Éléments exceptionnels" value={result.exceptional_elements} />
            <MetricCard label="Efficacité" value={`${result.efficiency.toFixed(1)}%`} />
          </div>

          <MatrixCard
            title="Matrice initiale"
            subtitle="Avant ordonnancement"
            matrix={result.initial_matrix}
            machineOrder={analytics.incidence.machine_codes}
            productOrder={analytics.incidence.product_references}
          />

          <MatrixCard
            title="Matrice ordonnée"
            subtitle="Après exécution de la méthode King"
            matrix={result.ordered_matrix}
            machineOrder={result.machine_order}
            productOrder={result.product_order}
            blocks={result.cell_blocks}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Cellules détectées
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {apiService.buildCells(result, analytics.machines).map((cell) => (
                <div key={cell.id} className="rounded-lg border-2 p-4" style={{ borderColor: cell.color }}>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cell.color }} />
                    <h3 className="font-semibold text-gray-900">{cell.code}</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    Lignes {cell.row_start + 1} à {cell.row_end + 1}, colonnes {cell.column_start + 1} à{' '}
                    {cell.column_end + 1}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cell.machine_ids.map((machineId) => {
                      const machine = analytics.machines.find((item) => item.id === machineId);
                      return (
                        <Badge key={machineId} style={{ backgroundColor: cell.color, color: 'white' }}>
                          {machine?.code}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">Lancez une première analyse pour afficher la matrice ordonnée.</CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-gray-600">{label}</div>
        <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      </CardContent>
    </Card>
  );
}

function MatrixCard({
  title,
  subtitle,
  matrix,
  machineOrder,
  productOrder,
  blocks,
}: {
  title: string;
  subtitle: string;
  matrix: number[][];
  machineOrder: string[];
  productOrder: string[];
  blocks?: Array<{ row_start: number; row_end: number; column_start: number; column_end: number; cell_index: number }>;
}) {
  const getCellColor = (rowIndex: number, colIndex: number) => {
    const block = blocks?.find(
      (item) =>
        rowIndex >= item.row_start &&
        rowIndex <= item.row_end &&
        colIndex >= item.column_start &&
        colIndex <= item.column_end,
    );

    if (!block) {
      return undefined;
    }

    return ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'][(block.cell_index - 1) % 6];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-gray-600">{subtitle}</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="border bg-gray-100 p-2">Machine / Produit</th>
              {productOrder.map((reference) => (
                <th key={reference} className="border bg-blue-50 p-2 font-mono">
                  {reference}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`}>
                <td className="border bg-gray-50 p-2 font-mono font-bold">{machineOrder[rowIndex]}</td>
                {row.map((cell, colIndex) => {
                  const color = getCellColor(rowIndex, colIndex);
                  return (
                    <td
                      key={`${rowIndex}-${colIndex}`}
                      className="border p-2 text-center font-semibold"
                      style={{
                        backgroundColor: cell === 1 ? color || '#1f2937' : 'white',
                        color: cell === 1 ? 'white' : '#9ca3af',
                      }}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
