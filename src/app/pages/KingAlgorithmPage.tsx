import { useMemo, useState } from 'react';
import { ChevronDown, Play, Sigma } from 'lucide-react';

import { MatrixTable } from '../components/csp/MatrixTable';
import { useAppData } from '../context/AppDataContext';
import { apiService } from '../services/api';
import { getCellInsights } from '../services/csp';

function computeColumnScores(matrix: number[][]) {
  const rows = matrix.length;
  const columns = matrix[0]?.length ?? 0;
  const scores = new Array(columns).fill(0);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      scores[columnIndex] += (2 ** (rows - rowIndex - 1)) * matrix[rowIndex][columnIndex];
    }
  }

  return scores;
}

function computeRowScores(matrix: number[][]) {
  const rows = matrix.length;
  const columns = matrix[0]?.length ?? 0;
  const scores = new Array(rows).fill(0);

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      scores[rowIndex] += (2 ** (columns - columnIndex - 1)) * matrix[rowIndex][columnIndex];
    }
  }

  return scores;
}

export function KingAlgorithmPage() {
  const { activeCompanyId, analytics, refreshData, loading, cells } = useAppData();
  const [running, setRunning] = useState(false);
  const [openIterations, setOpenIterations] = useState<number[]>([1]);
  const result = analytics?.latest_analysis ?? null;

  const orderedMatrix = result?.ordered_matrix ?? [];
  const finalCells = getCellInsights(analytics, cells);

  const syntheticIterations = useMemo(() => {
    if (!result || !orderedMatrix.length) {
      return [];
    }

    const columnScores = computeColumnScores(orderedMatrix);
    const rowScores = computeRowScores(orderedMatrix);

    return [
      {
        index: 1,
        converged: true,
        matrix: orderedMatrix,
        productOrder: result.product_order,
        machineOrder: result.machine_order,
        columnScores,
        rowScores,
      },
    ];
  }, [orderedMatrix, result]);

  const runAlgorithm = async () => {
    if (!activeCompanyId) {
      return;
    }

    setRunning(true);
    try {
      await apiService.runKingAlgorithm(activeCompanyId);
      await refreshData();
    } finally {
      setRunning(false);
    }
  };

  const toggleIteration = (index: number) => {
    setOpenIterations((current) => (current.includes(index) ? current.filter((value) => value !== index) : [...current, index]));
  };

  if (loading) {
    return <div className="rounded-2xl border border-dashed border-[#2a3045] p-10 text-center text-[#9299b0]">Chargement de la methode de King...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#4f8ef7]/10 px-3 py-1 text-xs font-medium text-[#a3c0ff]">
              <Sigma className="h-3.5 w-3.5" />
              Methode ROC de King
            </div>
            <h2 className="text-xl font-semibold text-white">Reordonnancement et formation des blocs diagonaux</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9299b0]">
              Cette vue reprend l’esprit de ton interface: lancement, matrice finale, details des scores binaires et lecture des ilots.
              Le backend applique maintenant la methode King puis le clustering pour construire les cellules.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void runAlgorithm()}
            disabled={running || !activeCompanyId}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f8ef7] to-[#7c5cfc] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-4 w-4" />
            {running ? 'Execution...' : 'Lancer King'}
          </button>
        </div>
      </section>

      {!result ? (
        <div className="rounded-2xl border border-dashed border-[#2a3045] p-10 text-center text-[#9299b0]">
          Importez une matrice puis lancez l'analyse King pour afficher la convergence, les scores et les ilots.
        </div>
      ) : null}

      {syntheticIterations.map((iteration) => {
        const isOpen = openIterations.includes(iteration.index);

        return (
          <section key={iteration.index} className="overflow-hidden rounded-2xl border border-[#2a3045] bg-[#13161e]">
            <button
              type="button"
              onClick={() => toggleIteration(iteration.index)}
              className="flex w-full items-center justify-between border-b border-[#2a3045] bg-[#1a1e2a] px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold text-white">Iteration {iteration.index}</div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                  Converge
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-[#9299b0] transition ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen ? (
              <div className="space-y-5 p-5">
                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="rounded-2xl border border-[#2a3045] bg-[#0d0f14] p-4">
                    <div className="mb-3 text-sm font-semibold text-[#4f8ef7]">Scores des colonnes</div>
                    <div className="space-y-2">
                      {iteration.machineOrder.map((machine, index) => (
                        <div key={machine} className="flex items-center justify-between rounded-xl border border-[#2a3045] px-3 py-2 text-sm">
                          <span className="font-mono text-white">{machine}</span>
                          <span className="font-mono text-[#f59e0b]">{iteration.columnScores[index] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#2a3045] bg-[#0d0f14] p-4">
                    <div className="mb-3 text-sm font-semibold text-[#7c5cfc]">Scores des lignes</div>
                    <div className="space-y-2">
                      {iteration.productOrder.map((product, index) => (
                        <div key={product} className="flex items-center justify-between rounded-xl border border-[#2a3045] px-3 py-2 text-sm">
                          <span className="font-mono text-white">{product}</span>
                          <span className="font-mono text-[#00d4aa]">{iteration.rowScores[index] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <MatrixTable
                  title={`Matrice stabilisee apres ${result.iterations} iteration(s)`}
                  rowLabels={iteration.productOrder}
                  columnLabels={iteration.machineOrder}
                  data={iteration.matrix}
                  cellRanges={finalCells.map((cell) => ({
                    rowStart: cell.rowStart,
                    rowEnd: cell.rowEnd,
                    columnStart: cell.columnStart,
                    columnEnd: cell.columnEnd,
                    color: cell.color,
                    residual: cell.residual,
                  }))}
                />
              </div>
            ) : null}
          </section>
        );
      })}

      {finalCells.length ? (
        <section className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
          <div className="mb-4 text-sm font-semibold text-white">Ilots detectes</div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {finalCells.map((cell) => (
              <div
                key={cell.id}
                className={`rounded-2xl border bg-[#0d0f14] p-4 ${
                  cell.residual ? 'border-amber-400/70 shadow-[0_0_0_1px_rgba(245,158,11,0.2)]' : 'border-[#2a3045]'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold text-white">{cell.code}</div>
                    {cell.residual ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
                        Residut
                      </span>
                    ) : null}
                  </div>
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cell.residual ? '#f59e0b' : cell.color }} />
                </div>
                <div className="mb-3 text-xs uppercase tracking-[0.2em] text-[#636980]">Machines</div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {cell.machines.map((machine) => (
                    <span key={machine} className="rounded-lg border border-[#4f8ef7]/20 bg-[#4f8ef7]/10 px-2.5 py-1 font-mono text-xs text-[#a3c0ff]">
                      {machine}
                    </span>
                  ))}
                </div>
                <div className="mb-3 text-xs uppercase tracking-[0.2em] text-[#636980]">Produits</div>
                <div className="flex flex-wrap gap-2">
                  {cell.products.map((product) => (
                    <span key={product} className="rounded-lg border border-[#7c5cfc]/20 bg-[#7c5cfc]/10 px-2.5 py-1 font-mono text-xs text-[#cab8ff]">
                      {product}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
