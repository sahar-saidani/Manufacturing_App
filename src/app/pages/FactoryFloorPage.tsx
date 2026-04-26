import { useEffect, useMemo, useState } from 'react';
import { Activity, Map as MapIcon, Network } from 'lucide-react';

import { useAppData } from '../context/AppDataContext';
import { getCellInsights, getChainonInsight, getFlowSummary } from '../services/csp';

function buildGridPositions(count: number) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  return Array.from({ length: count }, (_, index) => ({
    x: 90 + (index % columns) * 150,
    y: 90 + Math.floor(index / columns) * 100,
  }));
}

export function FactoryFloorPage() {
  const { analytics, cells, loading } = useAppData();
  const cellInsights = useMemo(() => getCellInsights(analytics, cells), [analytics, cells]);
  const [selectedCellId, setSelectedCellId] = useState<number | null>(cellInsights[0]?.id ?? null);
  const [view, setView] = useState<'trame' | 'flux'>('trame');

  useEffect(() => {
    setSelectedCellId((current) => current ?? cellInsights[0]?.id ?? null);
  }, [cellInsights]);

  if (loading) {
    return <div className="rounded-2xl border border-dashed border-[#2a3045] p-10 text-center text-[#9299b0]">Chargement de la trame et des flux...</div>;
  }

  if (!analytics) {
    return <div className="rounded-2xl border border-dashed border-[#2a3045] p-10 text-center text-[#9299b0]">Aucune donnee disponible.</div>;
  }

  const selectedCell = cellInsights.find((cell) => cell.id === selectedCellId) ?? cellInsights[0] ?? null;
  const chainon = getChainonInsight(analytics, selectedCell);
  const allFlows = getFlowSummary(analytics, cells);
  const positions = buildGridPositions(chainon?.machines.length ?? 0);

  const maxLinkFrequency = chainon?.links.length ? chainon.links[0].frequency : 1;
  const svgWidth = positions.length ? Math.max(...positions.map((position) => position.x)) + 90 : 600;
  const svgHeight = positions.length ? Math.max(...positions.map((position) => position.y)) + 90 : 320;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-[#4f8ef7]/15 p-2 text-[#4f8ef7]">
            <MapIcon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Trame et flux</h2>
            <p className="text-sm text-[#9299b0]">
              Visualisation de la disposition des machines d'un ilot et des liaisons deduites par la methode des chainons.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 md:flex-row">
            <select
              value={selectedCell?.id ?? ''}
              onChange={(event) => setSelectedCellId(Number(event.target.value))}
              className="h-11 min-w-[260px] rounded-xl border border-[#363e55] bg-[#0d0f14] px-3 text-sm text-[#e8eaf2] outline-none transition focus:border-[#4f8ef7]"
            >
              {cellInsights.length ? (
                cellInsights.map((cell) => (
                  <option key={cell.id} value={cell.id}>
                    {cell.code} - {cell.machines.join(', ')}
                  </option>
                ))
              ) : (
                <option value="">Aucun ilot</option>
              )}
            </select>

            <div className="inline-flex rounded-xl border border-[#2a3045] bg-[#0d0f14] p-1">
              <button
                type="button"
                onClick={() => setView('trame')}
                className={`rounded-lg px-4 py-2 text-sm transition ${view === 'trame' ? 'bg-[#13161e] text-[#4f8ef7]' : 'text-[#9299b0]'}`}
              >
                Trame atelier
              </button>
              <button
                type="button"
                onClick={() => setView('flux')}
                className={`rounded-lg px-4 py-2 text-sm transition ${view === 'flux' ? 'bg-[#13161e] text-[#4f8ef7]' : 'text-[#9299b0]'}`}
              >
                Graphe de flux
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#2a3045] bg-[#0d0f14] px-4 py-3 text-sm text-[#9299b0]">
            {allFlows.length} flux machine-machine disponibles a l'echelle de l'entreprise
          </div>
        </div>
      </section>

      {!chainon ? (
        <div className="rounded-2xl border border-dashed border-[#2a3045] p-10 text-center text-[#9299b0]">Aucun ilot exploitable pour la visualisation.</div>
      ) : null}

      {chainon ? (
        <>
          <section className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-400">
                {view === 'trame' ? <Activity className="h-4 w-4" /> : <Network className="h-4 w-4" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{view === 'trame' ? 'Trame de l’atelier' : 'Graphe de flux'}</div>
                <div className="text-xs text-[#9299b0]">{chainon.cell.code} - {chainon.machines.length} machines</div>
              </div>
            </div>

            <div className="overflow-auto rounded-2xl border border-[#2a3045] bg-[#0d0f14]">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="min-h-[360px] w-full">
                <rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#0d0f14" />

                {chainon.links.map((link) => {
                  const from = positions[link.fromIndex];
                  const to = positions[link.toIndex];
                  const color = link.strong ? '#10b981' : '#4f8ef7';
                  const strokeWidth = 1.5 + (link.frequency / maxLinkFrequency) * 4;

                  if (!from || !to) {
                    return null;
                  }

                  if (view === 'trame') {
                    return (
                      <g key={`${link.from}-${link.to}`}>
                        <line
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          stroke={color}
                          strokeWidth={strokeWidth}
                          strokeOpacity="0.8"
                        />
                        <text
                          x={(from.x + to.x) / 2}
                          y={(from.y + to.y) / 2 - 6}
                          fill={color}
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {link.frequency}
                        </text>
                      </g>
                    );
                  }

                  const controlX = (from.x + to.x) / 2 + (to.y - from.y) * 0.2;
                  const controlY = (from.y + to.y) / 2 - (to.x - from.x) * 0.2;

                  return (
                    <g key={`${link.from}-${link.to}`}>
                      <path
                        d={`M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeOpacity="0.85"
                      />
                      <text x={controlX} y={controlY - 6} fill={color} fontSize="10" textAnchor="middle">
                        {link.frequency}
                      </text>
                    </g>
                  );
                })}

                {chainon.machines.map((machine, index) => {
                  const position = positions[index];
                  if (!position) {
                    return null;
                  }

                  return (
                    <g key={machine}>
                      <rect
                        x={position.x - 46}
                        y={position.y - 24}
                        width="92"
                        height="48"
                        rx="10"
                        fill="#1f2535"
                        stroke="#4f8ef7"
                        strokeWidth="1.5"
                      />
                      <text x={position.x} y={position.y} fill="#e8eaf2" fontSize="11" fontWeight="600" textAnchor="middle">
                        {machine}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
              <div className="mb-4 text-sm font-semibold text-white">Machines de l'ilot</div>
              <div className="flex flex-wrap gap-2">
                {chainon.machines.map((machine) => (
                  <span key={machine} className="rounded-lg border border-[#4f8ef7]/20 bg-[#4f8ef7]/10 px-3 py-1 font-mono text-xs text-[#a3c0ff]">
                    {machine}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
              <div className="mb-4 text-sm font-semibold text-white">Produits de l'ilot</div>
              <div className="flex flex-wrap gap-2">
                {chainon.products.map((product) => (
                  <span key={product} className="rounded-lg border border-[#7c5cfc]/20 bg-[#7c5cfc]/10 px-3 py-1 font-mono text-xs text-[#cab8ff]">
                    {product}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
