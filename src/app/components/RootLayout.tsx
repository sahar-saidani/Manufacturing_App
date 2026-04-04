import { useState, type FormEvent } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { Factory, LayoutDashboard, Workflow, Cpu, Map, Upload, RefreshCw, Building2 } from 'lucide-react';
import { Toaster } from './ui/sonner';
import { useAppData } from '../context/AppDataContext';

export function RootLayout() {
  const location = useLocation();
  const { companies, activeCompanyId, error, loading, refreshing, backendLabel, setActiveCompanyId, createCompany } =
    useAppData();
  const [companyName, setCompanyName] = useState('');

  const navItems = [
    { path: '/', label: 'Tableau de bord', icon: LayoutDashboard },
    { path: '/gammes', label: 'Gammes', icon: Workflow },
    { path: '/machines', label: 'Machines', icon: Cpu },
    { path: '/king-algorithm', label: 'Algorithme King', icon: Factory },
    { path: '/factory-floor', label: "Plan d'usine", icon: Map },
    { path: '/import', label: 'Importer', icon: Upload },
  ];

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
      // Error is surfaced by the shared context.
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <Factory className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Analyse de formation d'îlots</h1>
                <p className="text-sm text-gray-500">Frontend React branché sur l'API Django</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <Building2 className="h-4 w-4" />
                <span>{backendLabel}</span>
                {refreshing && <RefreshCw className="h-4 w-4 animate-spin" />}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
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

                <form className="flex gap-2" onSubmit={(event) => void handleCreateCompany(event)}>
                  <input
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    placeholder="Nouvelle entreprise"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-300"
                    disabled={!companyName.trim() || refreshing}
                  >
                    Créer
                  </button>
                </form>
              </div>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </header>

      <nav className="border-b border-gray-200 bg-white">
        <div className="px-6">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="p-6">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      <Toaster />
    </div>
  );
}
