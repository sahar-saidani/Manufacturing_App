import { Link } from 'react-router';
import { ArrowRight, FileSpreadsheet, GitBranchPlus, Network } from 'lucide-react';

import { useAppData } from '../context/AppDataContext';

function ImportCard({
  title,
  description,
  hint,
  to,
  icon: Icon,
  tone,
}: {
  title: string;
  description: string;
  hint: string;
  to: string;
  icon: typeof FileSpreadsheet;
  tone: 'blue' | 'green';
}) {
  const toneClasses =
    tone === 'blue'
      ? 'from-[#4f8ef7]/15 to-[#7c5cfc]/15 text-[#a3c0ff]'
      : 'from-emerald-500/15 to-cyan-500/15 text-emerald-300';

  return (
    <div className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
      <div className="mb-4 flex items-start gap-4">
        <div className={`rounded-2xl bg-gradient-to-br p-3 ${toneClasses}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-[#9299b0]">{description}</p>
        </div>
      </div>
      <div className="mb-5 rounded-2xl border border-[#2a3045] bg-[#0d0f14] p-4 text-sm leading-6 text-[#9299b0]">
        {hint}
      </div>
      <Link
        to={to}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f8ef7] to-[#7c5cfc] px-5 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Ouvrir
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function ImportPage() {
  const { activeCompany } = useAppData();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
        <div className="mb-3 text-xs uppercase tracking-[0.24em] text-[#636980]">Donnees</div>
        <h2 className="text-xl font-semibold text-white">Centre d'import des fichiers</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#9299b0]">
          Importe la matrice pour King, puis alimente les analyses de chainons, dashboard, trame et flux.
          {activeCompany ? ` Entreprise active: ${activeCompany.name}.` : ' Selectionnez d’abord une entreprise active.'}
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ImportCard
          title="Import King"
          description="Depot de la matrice binaire produit x machine."
          hint="Formats supportes: .xlsx, .xls, .csv. Le backend conserve les vrais noms du fichier, affiche la matrice importee puis applique King sur cette base."
          to="/import/king"
          icon={FileSpreadsheet}
          tone="blue"
        />
        <ImportCard
          title="Import Chainon"
          description="Depot separe pour les donnees liees aux gammes et flux."
          hint="Cette page garde une entree distincte pour les fichiers chainon quand le flux de preparation ne doit pas etre melange au depot King."
          to="/import/chainon"
          icon={GitBranchPlus}
          tone="green"
        />
      </section>

      <section className="rounded-2xl border border-[#2a3045] bg-[#13161e] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-[#4f8ef7]/15 p-2 text-[#4f8ef7]">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Separation des flux</div>
            <div className="text-xs text-[#9299b0]">King et chainon disposent d'entrees dediees</div>
          </div>
        </div>
        <div className="rounded-2xl border border-[#2a3045] bg-[#0d0f14] p-4 text-sm leading-6 text-[#9299b0]">
          La navigation reprend maintenant le schema de ton interface: import, methode de King, ilots, dashboard, chainons puis trame et flux.
          Le depot King alimente directement l'aperçu matriciel et l'analyse reordonnee.
        </div>
      </section>
    </div>
  );
}
