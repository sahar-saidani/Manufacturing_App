import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Factory, Package, Layers, ArrowRightLeft, Activity, Gauge } from 'lucide-react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import type { ComponentType, ReactNode } from 'react';
import { useAppData } from '../context/AppDataContext';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export function Dashboard() {
  const { loading, metrics, analytics, cells, activeCompany } = useAppData();

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-500">Chargement du tableau de bord...</div>;
  }

  if (!activeCompany || !metrics || !analytics) {
    return <div className="rounded-lg border border-dashed border-gray-300 p-8 text-gray-500">Créez une entreprise pour commencer.</div>;
  }

  const flowChartData = {
    labels: ['Intra-cellules', 'Inter-cellules'],
    datasets: [
      {
        data: [100 - metrics.inter_cell_flow_percentage, metrics.inter_cell_flow_percentage],
        backgroundColor: ['#16a34a', '#dc2626'],
        borderWidth: 0,
      },
    ],
  };

  const efficiencyChartData = {
    labels: ['Efficacité', 'Marge'],
    datasets: [
      {
        data: [metrics.efficiency_score, Math.max(0, 100 - metrics.efficiency_score)],
        backgroundColor: ['#2563eb', '#e5e7eb'],
        borderWidth: 0,
      },
    ],
  };

  const cellDistributionData = {
    labels: cells.map((cell) => cell.code),
    datasets: [
      {
        label: 'Machines par cellule',
        data: cells.map((cell) => cell.machine_ids.length),
        backgroundColor: cells.map((cell) => cell.color),
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Tableau de bord</h2>
        <p className="mt-1 text-gray-600">Synthèse de {activeCompany.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Factory} label="Machines" value={metrics.total_machines} hint="Machines enregistrées" />
        <StatCard icon={Package} label="Produits" value={metrics.total_products} hint="Références actives" />
        <StatCard icon={Layers} label="Cellules" value={metrics.total_cells} hint="Issues de la dernière analyse" />
        <StatCard
          icon={ArrowRightLeft}
          label="Flux inter-cellules"
          value={`${metrics.inter_cell_flow_percentage.toFixed(1)}%`}
          hint={`${metrics.total_flows} flux enregistrés`}
        />
        <StatCard
          icon={Activity}
          label="Taille moyenne"
          value={metrics.average_cell_size.toFixed(1)}
          hint="Machines par cellule"
        />
        <StatCard icon={Gauge} label="Efficacité King" value={`${metrics.efficiency_score.toFixed(1)}%`} hint="Dernière exécution" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard title="Répartition des flux">
          <div className="mx-auto h-64 w-64">
            <Doughnut data={flowChartData} options={{ plugins: { legend: { position: 'bottom' } } }} />
          </div>
        </ChartCard>

        <ChartCard title="Score d'efficacité">
          <div className="mx-auto h-64 w-64">
            <Doughnut data={efficiencyChartData} options={{ plugins: { legend: { position: 'bottom' } } }} />
          </div>
        </ChartCard>

        <ChartCard title="Distribution des machines">
          <div className="h-64">
            <Bar
              data={cellDistributionData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
              }}
            />
          </div>
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incidence machines / produits</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border bg-gray-100 p-2 text-left">Machine</th>
                {analytics.incidence.product_references.map((reference) => (
                  <th key={reference} className="border bg-gray-100 p-2 text-center font-mono">
                    {reference}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analytics.incidence.matrix.map((row, rowIndex) => (
                <tr key={analytics.incidence.machine_codes[rowIndex]}>
                  <td className="border bg-gray-50 p-2 font-mono">{analytics.incidence.machine_codes[rowIndex]}</td>
                  {row.map((value, colIndex) => (
                    <td key={`${rowIndex}-${colIndex}`} className="border p-2 text-center">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{label}</CardTitle>
        <Icon className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
