import { useEffect, useMemo, useState } from 'react';
import { GitBranchPlus, Route, Shuffle } from 'lucide-react';

import { useAppData } from '../context/AppDataContext';
import { getCellInsights, getChainonInsight } from '../services/csp';

export function ChainonPage() {
  const { analytics, cells, loading } = useAppData();
  const cellInsights = useMemo(() => getCellInsights(analytics, cells), [analytics, cells]);
  const [selectedCellId, setSelectedCellId] = useState<number | null>(cellInsights[0]?.id ?? null);

  useEffect(() => {
    setSelectedCellId((current) => current ?? cellInsights[0]?.id ?? null);
  }, [cellInsights]);

  if (loading) {
    return <div className="rounded-2xl border border-dashed border-[#2a3045] p-10 text-center text-[#9299b0]">Chargement de la methode des chainons...</div>;
  }

  if (!analytics) {
    return <div className="rounded-2xl border border-dashed border-[#2a3045] p-10 text-center text-[#9299b0]">Aucune donnee disponible pour les chainons.</div>;
  }

  const selectedCell = cellInsights.find((cell) => cell.id === selectedCellId) ?? cellInsights[0] ?? null;
  const chainon = getChainonInsight(analytics, selectedCell);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/15 p-2 text-amber-300">
            <GitBranchPlus className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Methode des chainons</h2>
            <p className="text-sm text-[#9299b0]">
              Analyse des sequences reelles de fabrication a l'interieur de chaque ilot pour mesurer les liaisons machine-a-machine.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <select
            value={selectedCell?.id ?? ''}
            onChange={(event) => setSelectedCellId(Number(event.target.value))}
            className="h-11 min-w-[240px] rounded-xl border border-[#363e55] bg-[#0d0f14] px-3 text-sm text-[#e8eaf2] outline-none transition focus:border-[#4f8ef7]"
          >
            {cellInsights.length ? (
              cellInsights.map((cell) => (
                <option key={cell.id} value={cell.id}>
                  {cell.code} - {cell.machines.join(', ')}
                </option>
              ))
            ) : (
              <option value="">Aucun ilot detecte</option>
            )}
          </select>
          <div className="rounded-xl border border-[#2a3045] bg-[#0d0f14] px-4 py-3 text-sm text-[#9299b0]">
            Sequences derivees des routes produit deja importees dans le backend.
          </div>
        </div>
      </section>

      {!chainon ? (
        <div className="rounded-2xl border border-dashed border-[#2a3045] p-10 text-center text-[#9299b0]">Executez King pour former des ilots avant d'analyser les chainons.</div>
      ) : null}

      {chainon ? (
        <>
          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-[#4f8ef7]/15 p-2 text-[#4f8ef7]">
                  <Route className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Sequences de fabrication</div>
                  <div className="text-xs text-[#9299b0]">Par produit dans {chainon.cell.code}</div>
                </div>
              </div>

              <div className="space-y-3">
                {chainon.sequences.length ? (
                  chainon.sequences.map((sequence) => (
                    <div key={sequence.product} className="rounded-2xl border border-[#2a3045] bg-[#0d0f14] p-4">
                      <div className="mb-2 font-mono text-sm font-semibold text-white">{sequence.product}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#9299b0]">
                        {sequence.machines.map((machine, index) => (
                          <div key={`${sequence.product}-${machine}-${index}`} className="flex items-center gap-2">
                            <span className="rounded-lg border border-[#4f8ef7]/20 bg-[#4f8ef7]/10 px-2.5 py-1 font-mono text-[#a3c0ff]">
                              {machine}
                            </span>
                            {index < sequence.machines.length - 1 ? <span>→</span> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#2a3045] p-8 text-center text-[#9299b0]">Aucune sequence exploitable pour cet ilot.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-400">
                  <Shuffle className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Liaisons fortes</div>
                  <div className="text-xs text-[#9299b0]">Seuil de force: {chainon.strongThreshold.toFixed(1)}</div>
                </div>
              </div>

              <div className="space-y-3">
                {chainon.links.length ? (
                  chainon.links.map((link) => (
                    <div key={`${link.from}-${link.to}`} className="rounded-2xl border border-[#2a3045] bg-[#0d0f14] p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="font-mono text-sm text-white">
                          {link.from} ↔ {link.to}
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${link.strong ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                          {link.strong ? 'FORTE' : 'faible'}
                        </span>
                      </div>
                      <div className="mb-2 text-sm text-[#9299b0]">Frequence cumulee: {link.frequency}</div>
                      <div className="h-2 rounded-full bg-[#1a1e2a]">
                        <div
                          className={`h-2 rounded-full ${link.strong ? 'bg-emerald-400' : 'bg-[#4f8ef7]'}`}
                          style={{
                            width: `${chainon.links[0] ? (link.frequency / chainon.links[0].frequency) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#2a3045] p-8 text-center text-[#9299b0]">Aucun chainon detecte.</div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
            <div className="mb-4 text-sm font-semibold text-white">Matrice des frequences de passage</div>
            <div className="overflow-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border border-[#2a3045] bg-[#1a1e2a] px-4 py-3 text-left text-[#9299b0]">De / Vers</th>
                    {chainon.machines.map((machine) => (
                      <th key={machine} className="border border-[#2a3045] bg-[#1a1e2a] px-4 py-3 font-mono text-[#4f8ef7]">
                        {machine}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chainon.machines.map((machine, rowIndex) => (
                    <tr key={machine}>
                      <td className="border border-[#2a3045] bg-[#1a1e2a] px-4 py-3 font-mono font-semibold text-white">{machine}</td>
                      {chainon.frequencyMatrix[rowIndex].map((value, columnIndex) => (
                        <td
                          key={`${machine}-${columnIndex}`}
                          className={`border border-[#2a3045] px-4 py-3 text-center font-mono ${
                            value > 0 ? 'text-emerald-400' : 'text-[#636980]'
                          }`}
                        >
                          {rowIndex === columnIndex ? '—' : value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
