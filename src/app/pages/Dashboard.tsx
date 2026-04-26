import { BarChart3, Boxes, Factory, Gauge, GitBranchPlus, Package2 } from 'lucide-react';

import { MatrixTable } from '../components/csp/MatrixTable';
import { useAppData } from '../context/AppDataContext';
import { getCellInsights, getExceptionalEntries, getOrderedMatrixRows } from '../services/csp';

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Factory;
}) {
  return (
    <div className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#636980]">{label}</div>
        <Icon className="h-4 w-4 text-[#4f8ef7]" />
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="mt-2 text-sm text-[#9299b0]">{hint}</div>
    </div>
  );
}

export function Dashboard() {
  const { loading, analytics, cells, metrics } = useAppData();

  if (loading) {
    return <div className="rounded-2xl border border-dashed border-[#2a3045] p-10 text-center text-[#9299b0]">Chargement du dashboard...</div>;
  }

  if (!analytics || !metrics) {
    return <div className="rounded-2xl border border-dashed border-[#2a3045] p-10 text-center text-[#9299b0]">Creez une entreprise et importez une matrice pour commencer.</div>;
  }

  const orderedRows = getOrderedMatrixRows(analytics.latest_analysis);
  const cellInsights = getCellInsights(analytics, cells);
  const exceptions = getExceptionalEntries(analytics.latest_analysis, cellInsights);
  const largestCell = cellInsights.reduce((best, current) => (current.machines.length > best.machines.length ? current : best), {
    machines: [],
    products: [],
  } as (typeof cellInsights)[number] | { machines: string[]; products: string[] });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ilots detectes" value={cells.length} hint="Apres application de King et clustering" icon={Boxes} />
        <MetricCard label="Machines" value={metrics.total_machines} hint="Ressources disponibles" icon={Factory} />
        <MetricCard label="Produits" value={metrics.total_products} hint="References prises en compte" icon={Package2} />
        <MetricCard
          label="Flux inter-ilots"
          value={`${metrics.inter_cell_flow_percentage.toFixed(1)}%`}
          hint={`${metrics.total_flows} flux enregistres`}
          icon={GitBranchPlus}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-[#4f8ef7]/15 p-2 text-[#4f8ef7]">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Synthese des ilots</div>
              <div className="text-xs text-[#9299b0]">Vue rapide sur la taille des cellules detectees</div>
            </div>
          </div>

          <div className="space-y-4">
            {cellInsights.length ? (
              cellInsights.map((cell) => {
                const maxMachines = Math.max(...cellInsights.map((item) => item.machines.length));
                const maxProducts = Math.max(...cellInsights.map((item) => item.products.length));
                const machineWidth = maxMachines ? (cell.machines.length / maxMachines) * 100 : 0;
                const productWidth = maxProducts ? (cell.products.length / maxProducts) * 100 : 0;

                return (
                  <div
                    key={cell.id}
                    className={`rounded-2xl border bg-[#0d0f14] p-4 ${
                      cell.residual ? 'border-amber-400/70' : 'border-[#2a3045]'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-white">{cell.code}</div>
                        {cell.residual ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
                            Residut
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-[#636980]">{cell.machines.length} machines / {cell.products.length} produits</div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 text-xs text-[#9299b0]">Machines</div>
                        <div className="h-2 rounded-full bg-[#1a1e2a]">
                          <div className="h-2 rounded-full" style={{ width: `${machineWidth}%`, backgroundColor: cell.residual ? '#f59e0b' : cell.color }} />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-[#9299b0]">Produits</div>
                        <div className="h-2 rounded-full bg-[#1a1e2a]">
                          <div className="h-2 rounded-full bg-[#7c5cfc]" style={{ width: `${productWidth}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-[#2a3045] p-8 text-center text-[#9299b0]">Executez l'analyse King pour remplir le dashboard.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-400">
                <Gauge className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Performance globale</div>
                <div className="text-xs text-[#9299b0]">Qualite de la derniere organisation</div>
              </div>
            </div>
            <div className="mb-3 text-4xl font-bold text-white">{metrics.efficiency_score.toFixed(1)}%</div>
            <div className="h-3 rounded-full bg-[#1a1e2a]">
              <div className="h-3 rounded-full bg-gradient-to-r from-[#00d4aa] to-[#4f8ef7]" style={{ width: `${Math.max(0, Math.min(metrics.efficiency_score, 100))}%` }} />
            </div>
            <div className="mt-3 text-sm text-[#9299b0]">
              Plus le score est eleve, plus les `1` sont regroupes dans des blocs coherents.
            </div>
          </div>

          <div className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
            <div className="mb-4 text-sm font-semibold text-white">Points remarquables</div>
            <div className="space-y-3 text-sm text-[#9299b0]">
              <div className="rounded-xl border border-[#2a3045] bg-[#0d0f14] p-4">
                Ilot principal : <span className="font-semibold text-white">{'code' in largestCell ? largestCell.code : '—'}</span>
              </div>
              <div className="rounded-xl border border-[#2a3045] bg-[#0d0f14] p-4">
                Exceptions hors blocs : <span className="font-semibold text-white">{exceptions.length}</span>
              </div>
              <div className="rounded-xl border border-[#2a3045] bg-[#0d0f14] p-4">
                Matrice ordonnee : <span className="font-semibold text-white">{orderedRows.length ? 'disponible' : 'non calculee'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
        <div className="mb-4 text-sm font-semibold text-white">Recapitulatif des ilots</div>
        {cellInsights.length ? (
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-[#2a3045] bg-[#1a1e2a] px-4 py-3 text-left text-[#4f8ef7]">Ilot</th>
                  <th className="border border-[#2a3045] bg-[#1a1e2a] px-4 py-3 text-left text-[#4f8ef7]">Machines</th>
                  <th className="border border-[#2a3045] bg-[#1a1e2a] px-4 py-3 text-left text-[#4f8ef7]">Produits</th>
                </tr>
              </thead>
              <tbody>
                {cellInsights.map((cell) => (
                  <tr key={cell.id}>
                    <td className="border border-[#2a3045] px-4 py-3 font-semibold text-white">
                      {cell.code}
                      {cell.residual ? <span className="ml-2 text-xs text-amber-300">Residut</span> : null}
                    </td>
                    <td className="border border-[#2a3045] px-4 py-3 text-[#9299b0]">{cell.machines.join(', ')}</td>
                    <td className="border border-[#2a3045] px-4 py-3 text-[#9299b0]">{cell.products.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#2a3045] p-8 text-center text-[#9299b0]">Aucun ilot disponible.</div>
        )}
      </section>

      {analytics.latest_analysis ? (
        <MatrixTable
          title="Matrice finale reordonnee"
          rowLabels={analytics.latest_analysis.product_order}
          columnLabels={analytics.latest_analysis.machine_order}
          data={analytics.latest_analysis.ordered_matrix}
          cellRanges={cellInsights.map((cell) => ({
            rowStart: cell.rowStart,
            rowEnd: cell.rowEnd,
            columnStart: cell.columnStart,
            columnEnd: cell.columnEnd,
            color: cell.color,
            residual: cell.residual,
          }))}
        />
      ) : null}
    </div>
  );
}
