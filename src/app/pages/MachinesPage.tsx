import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Cpu } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';

export function MachinesPage() {
  const { loading, analytics, cells } = useAppData();

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Chargement des machines...</div>;
  }

  if (!analytics) {
    return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-gray-500">Aucune machine disponible.</div>;
  }

  const getCellForMachine = (machineId: number) => cells.find((cell) => cell.machine_ids.includes(machineId));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Machines</h2>
        <p className="mt-1 text-gray-600">Machines de l'entreprise et affectation aux cellules</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Liste des machines ({analytics.machines.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Cellule actuelle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.machines.map((machine) => {
                const cell = getCellForMachine(machine.id);

                return (
                  <TableRow key={machine.id}>
                    <TableCell className="font-mono font-medium">{machine.code}</TableCell>
                    <TableCell className="font-medium">{machine.name}</TableCell>
                    <TableCell className="text-gray-600">{machine.description || '-'}</TableCell>
                    <TableCell>
                      {cell ? (
                        <Badge style={{ backgroundColor: cell.color, color: 'white' }}>{cell.code}</Badge>
                      ) : (
                        <Badge variant="outline">Non affectée</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {cells.length ? (
          cells.map((cell) => {
            const cellMachines = analytics.machines.filter((machine) => cell.machine_ids.includes(machine.id));
            return (
              <Card key={cell.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cell.color }} />
                    {cell.code}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-gray-600">{cell.name}</div>
                  {cellMachines.map((machine) => (
                    <div key={machine.id} className="flex items-center justify-between rounded border p-2">
                      <div>
                        <div className="font-medium text-sm">
                          {machine.code} - {machine.name}
                        </div>
                        <div className="text-xs text-gray-500">{machine.description || 'Sans description'}</div>
                      </div>
                      <Badge variant="secondary">Cellule {cell.id}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="lg:col-span-2">
            <CardContent className="py-10 text-center text-gray-500">
              Exécutez l'algorithme King pour générer les affectations de cellules.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
