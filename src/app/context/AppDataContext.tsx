import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiService } from '../services/api';
import { Cell, Company, CompanyAnalytics, DashboardMetrics } from '../types';

type AppDataContextValue = {
  companies: Company[];
  activeCompanyId: number | null;
  activeCompany: Company | null;
  analytics: CompanyAnalytics | null;
  cells: Cell[];
  metrics: DashboardMetrics | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  backendLabel: string;
  setActiveCompanyId: (companyId: number) => Promise<void>;
  refreshData: () => Promise<void>;
  createCompany: (payload: { name: string; description?: string }) => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<CompanyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompanies = async (preferredCompanyId?: number | null) => {
    const fetchedCompanies = await apiService.getCompanies();
    setCompanies(fetchedCompanies);

    if (!fetchedCompanies.length) {
      setActiveCompanyIdState(null);
      setAnalytics(null);
      return;
    }

    const nextCompanyId =
      preferredCompanyId && fetchedCompanies.some((company) => company.id === preferredCompanyId)
        ? preferredCompanyId
        : fetchedCompanies[0].id;

    setActiveCompanyIdState(nextCompanyId);
    const analyticsPayload = await apiService.getCompanyAnalytics(nextCompanyId);
    setAnalytics(analyticsPayload);
  };

  const refreshData = async () => {
    if (!activeCompanyId) {
      await loadCompanies(activeCompanyId);
      return;
    }

    setRefreshing(true);
    setError(null);
    try {
      const analyticsPayload = await apiService.getCompanyAnalytics(activeCompanyId);
      setAnalytics(analyticsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setRefreshing(false);
    }
  };

  const setActiveCompanyId = async (companyId: number) => {
    setRefreshing(true);
    setError(null);
    try {
      const analyticsPayload = await apiService.getCompanyAnalytics(companyId);
      setActiveCompanyIdState(companyId);
      setAnalytics(analyticsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setRefreshing(false);
    }
  };

  const createCompany = async (payload: { name: string; description?: string }) => {
    setRefreshing(true);
    setError(null);
    try {
      const company = await apiService.createCompany(payload);
      await loadCompanies(company.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      throw err;
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadCompanies();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, []);

  const cells = useMemo(
    () => apiService.buildCells(analytics?.latest_analysis ?? null, analytics?.machines ?? []),
    [analytics],
  );

  const metrics = useMemo(
    () => (analytics ? apiService.getDashboardMetrics(analytics, cells) : null),
    [analytics, cells],
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      companies,
      activeCompanyId,
      activeCompany: companies.find((company) => company.id === activeCompanyId) || null,
      analytics,
      cells,
      metrics,
      loading,
      refreshing,
      error,
      backendLabel: apiService.getBaseUrl(),
      setActiveCompanyId,
      refreshData,
      createCompany,
    }),
    [companies, activeCompanyId, analytics, cells, metrics, loading, refreshing, error],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
}
