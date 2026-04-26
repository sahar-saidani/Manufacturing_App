import { useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import {
  ArrowUpDown,
  Building2,
  Factory,
  GitBranchPlus,
  LayoutDashboard,
  Map,
  RefreshCw,
  Upload,
  Workflow,
  Wrench,
} from 'lucide-react';

import { Toaster } from './ui/sonner';
import { useAppData } from '../context/AppDataContext';

const navGroups = [
  {
    title: 'Donnees',
    items: [
      { path: '/import', label: 'Import Excel', icon: Upload, title: 'Import Excel', breadcrumb: 'Donnees' },
    ],
  },
  {
    title: 'Analyse',
    items: [
      {
        path: '/king-algorithm',
        label: 'Methode de King',
        icon: Factory,
        title: 'Methode de King (ROC)',
        breadcrumb: 'Analyse',
      },
    ],
  },
  {
    title: 'Optimisation',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, title: 'Dashboard', breadcrumb: 'Optimisation' },
      { path: '/chainon', label: 'Methode des Chainons', icon: GitBranchPlus, title: 'Methode des Chainons', breadcrumb: 'Optimisation' },
      { path: '/factory-floor', label: 'Trame et Flux', icon: Map, title: 'Trame et Flux', breadcrumb: 'Visualisation' },
    ],
  },
  {
    title: 'References',
    items: [
      { path: '/gammes', label: 'Gammes', icon: Workflow, title: 'Gammes', breadcrumb: 'References' },
      { path: '/machines', label: 'Machines', icon: Wrench, title: 'Machines', breadcrumb: 'References' },
    ],
  },
];

function getPageMeta(pathname: string) {
  for (const group of navGroups) {
    const exactMatch = group.items.find((item) => item.path === pathname);
    if (exactMatch) {
      return exactMatch;
    }
  }

  if (pathname.startsWith('/import/king')) {
    return { title: 'Import King', breadcrumb: 'Donnees', path: '/import', label: 'Import Excel', icon: Upload };
  }

  if (pathname.startsWith('/import/chainon')) {
    return { title: 'Import Chainon', breadcrumb: 'Donnees', path: '/import', label: 'Import Excel', icon: Upload };
  }

  return { title: 'Interface CSP', breadcrumb: 'Application', path: '/', label: 'Dashboard', icon: LayoutDashboard };
}

export function RootLayout() {
  const location = useLocation();
  const { companies, activeCompanyId, error, loading, refreshing, backendLabel, setActiveCompanyId, createCompany, analytics, cells } =
    useAppData();
  const [companyName, setCompanyName] = useState('');
  const pageMeta = getPageMeta(location.pathname);

  const handleCreateCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = companyName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      await createCompany({ name: trimmedName });
      setCompanyName('');
    } catch {
      // The shared context already exposes the error state.
    }
  };

  const statusLabel = cells.length
    ? `${cells.length} ilot(s) detecte(s)`
    : analytics
      ? `${analytics.summary.machines}x${analytics.summary.products} chargee`
      : 'Aucune donnee';

  return (
    <div className="min-h-screen bg-[#0d0f14] text-[#e8eaf2]">
      <div className="fixed inset-y-0 left-0 hidden w-[220px] border-r border-[#2a3045] bg-[#13161e] lg:block">
        <div className="border-b border-[#2a3045] px-5 py-5">
          <div className="mb-2 inline-flex rounded-md bg-gradient-to-r from-[#4f8ef7] to-[#7c5cfc] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white">
            GI2B
          </div>
          <div className="text-sm font-semibold text-white">Implantation CSP</div>
          <div className="mt-1 text-xs text-[#636980]">Cellules de production</div>
        </div>

        <div className="px-0 py-3">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-4">
              <div className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#636980]">
                {group.title}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`mx-3 mb-1 flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition ${
                      active
                        ? 'border-[#4f8ef7]/30 bg-[#4f8ef7]/12 text-[#4f8ef7]'
                        : 'border-transparent text-[#9299b0] hover:border-[#2a3045] hover:bg-[#1a1e2a] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="lg:ml-[220px]">
        <header className="sticky top-0 z-40 border-b border-[#2a3045] bg-[#13161e]/95 backdrop-blur">
          <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">{pageMeta.title}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[#636980]">
                <span>GI2B</span>
                <span>›</span>
                <span>{pageMeta.breadcrumb}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    cells.length
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : analytics
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-slate-500/15 text-slate-400'
                  }`}
                >
                  {statusLabel}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#363e55] bg-[#1a1e2a] px-3 py-1 text-xs text-[#9299b0]">
                  <Building2 className="h-3.5 w-3.5" />
                  {backendLabel}
                  {refreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                </span>
              </div>

              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative">
                  <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#636980]" />
                  <select
                    className="h-10 min-w-[220px] rounded-xl border border-[#363e55] bg-[#1a1e2a] pl-10 pr-3 text-sm text-[#e8eaf2] outline-none transition focus:border-[#4f8ef7]"
                    disabled={loading || !companies.length}
                    value={activeCompanyId ?? ''}
                    onChange={(event) => void setActiveCompanyId(Number(event.target.value))}
                  >
                    {companies.length ? (
                      companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))
                    ) : (
                      <option value="">Aucune entreprise</option>
                    )}
                  </select>
                </div>

                <form className="flex gap-2" onSubmit={(event) => void handleCreateCompany(event)}>
                  <input
                    className="h-10 min-w-[210px] rounded-xl border border-[#363e55] bg-[#1a1e2a] px-3 text-sm text-[#e8eaf2] outline-none transition placeholder:text-[#636980] focus:border-[#4f8ef7]"
                    placeholder="Nouvelle entreprise"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-xl bg-gradient-to-r from-[#4f8ef7] to-[#7c5cfc] px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!companyName.trim() || refreshing}
                  >
                    Creer
                  </button>
                </form>
              </div>

              {error ? <div className="text-xs text-red-400">{error}</div> : null}
            </div>
          </div>
        </header>

        <main className="px-4 py-6 md:px-6">
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  );
}
