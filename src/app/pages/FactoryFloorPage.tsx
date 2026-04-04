import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Factory, ArrowRightLeft } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';

export function FactoryFloorPage() {
  const { loading, analytics, cells } = useAppData();

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Chargement du plan d'usine...</div>;
  }

  if (!analytics) {
    return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-gray-500">Aucune donnée disponible.</div>;
  }

  const interCellFlows = analytics.flows
    .map((flow) => {
      const fromMachine = analytics.machines.find((machine) => machine.id === flow.from_machine);
      const toMachine = analytics.machines.find((machine) => machine.id === flow.to_machine);
      const fromCell = cells.find((cell) => cell.id === fromMachine?.current_cell);
      const toCell = cells.find((cell) => cell.id === toMachine?.current_cell);

      if (!fromCell || !toCell || fromCell.id === toCell.id) {
        return null;
      }

      return { flow, fromCell, toCell };
    })
    .filter(Boolean) as Array<{
    flow: (typeof analytics.flows)[number];
    fromCell: (typeof cells)[number];
    toCell: (typeof cells)[number];
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Plan d'usine</h2>
        <p className="mt-1 text-gray-600">Visualisation des cellules et des flux entre machines</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Répartition des cellules
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {cells.length ? (
            cells.map((cell) => {
              const machineCodes = analytics.machines
                .filter((machine) => cell.machine_ids.includes(machine.id))
                .map((machine) => machine.code);

              return (
                <div
                  key={cell.id}
                  className="rounded-xl border p-5"
                  style={{ borderColor: cell.color, backgroundColor: `${cell.color}10` }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: cell.color }} />
                    <h3 className="font-semibold text-gray-900">{cell.code}</h3>
                  </div>
                  <p className="text-sm text-gray-600">{cell.name}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {machineCodes.map((code) => (
                      <Badge key={code} style={{ backgroundColor: cell.color, color: 'white' }}>
                        {code}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-8 text-gray-500 lg:col-span-2">
              Aucune cellule détectée. Exécutez l'algorithme King.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Flux inter-cellules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {interCellFlows.length ? (
            <div className="space-y-3">
              {interCellFlows.map(({ flow, fromCell, toCell }) => (
                <div key={flow.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Badge style={{ backgroundColor: fromCell.color, color: 'white' }}>{fromCell.code}</Badge>
                    <span className="text-gray-400">→</span>
                    <Badge style={{ backgroundColor: toCell.color, color: 'white' }}>{toCell.code}</Badge>
                    <span className="text-sm text-gray-600">
                      {flow.from_machine_code} → {flow.to_machine_code}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-red-600">{flow.ul_value} UL</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">Aucun flux inter-cellules détecté.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
