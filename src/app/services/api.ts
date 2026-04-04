import {
  Cell,
  Company,
  CompanyAnalytics,
  DashboardMetrics,
  KingAlgorithmResult,
  Machine,
  MaterialFlow,
  Product,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');
const CELL_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

type RequestOptions = RequestInit & {
  skipJsonHeader?: boolean;
};

class ApiService {
  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (!options.skipJsonHeader && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        detail = payload.detail || JSON.stringify(payload);
      } catch {
        // Ignore non-JSON error payloads.
      }
      throw new Error(detail);
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  }

  async getCompanies(): Promise<Company[]> {
    return this.request<Company[]>('/companies/');
  }

  async createCompany(payload: { name: string; description?: string }): Promise<Company> {
    return this.request<Company>('/companies/', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        description: payload.description || '',
      }),
    });
  }

  async getCompanyAnalytics(companyId: number): Promise<CompanyAnalytics> {
    return this.request<CompanyAnalytics>(`/companies/${companyId}/analytics/`);
  }

  async createMachine(companyId: number, payload: { code: string; name: string; description?: string }): Promise<Machine> {
    return this.request<Machine>(`/companies/${companyId}/machines/`, {
      method: 'POST',
      body: JSON.stringify({
        code: payload.code,
        name: payload.name,
        description: payload.description || '',
      }),
    });
  }

  async createProduct(
    companyId: number,
    payload: {
      reference: string;
      name: string;
      batch_size: number;
      annual_demand: number;
      routes?: Array<{
        machine_code?: string;
        machine?: number;
        operation_order: number;
        operation_name?: string;
        duration_minutes?: number;
      }>;
    },
  ): Promise<Product> {
    return this.request<Product>(`/companies/${companyId}/products/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async importFromFile(companyId: number, file: File): Promise<{ detail: string; imported: Record<string, number> }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<{ detail: string; imported: Record<string, number> }>(
      `/companies/${companyId}/import/`,
      { method: 'POST', body: formData, skipJsonHeader: true },
    );
  }

  async runKingAlgorithm(companyId: number): Promise<KingAlgorithmResult> {
    return this.request<KingAlgorithmResult>(`/companies/${companyId}/run-king/`, {
      method: 'POST',
    });
  }

  buildCells(analysis: KingAlgorithmResult | null, machines: Machine[]): Cell[] {
    if (!analysis) {
      return [];
    }

    return analysis.cell_blocks.map((block, index) => {
      const machineIds = analysis.machine_assignments
        .filter((assignment) => assignment.cell_index === block.cell_index)
        .map((assignment) => assignment.machine);

      const machineNames = machines
        .filter((machine) => machineIds.includes(machine.id))
        .map((machine) => machine.code)
        .join(', ');

      return {
        id: block.cell_index,
        code: `C${block.cell_index}`,
        name: machineNames ? `Cellule ${block.cell_index} · ${machineNames}` : `Cellule ${block.cell_index}`,
        machine_ids: machineIds,
        color: CELL_COLORS[index % CELL_COLORS.length],
        row_start: block.row_start,
        row_end: block.row_end,
        column_start: block.column_start,
        column_end: block.column_end,
      };
    });
  }

  getDashboardMetrics(analytics: CompanyAnalytics, cells: Cell[]): DashboardMetrics {
    const interCellFlowVolume = analytics.flows.reduce((sum, flow) => {
      const fromMachine = analytics.machines.find((machine) => machine.id === flow.from_machine);
      const toMachine = analytics.machines.find((machine) => machine.id === flow.to_machine);
      if (fromMachine?.current_cell && toMachine?.current_cell && fromMachine.current_cell !== toMachine.current_cell) {
        return sum + flow.ul_value;
      }
      return sum;
    }, 0);

    const totalFlowVolume = analytics.flows.reduce((sum, flow) => sum + flow.ul_value, 0);

    return {
      total_machines: analytics.summary.machines,
      total_products: analytics.summary.products,
      total_cells: cells.length,
      inter_cell_flow_percentage: totalFlowVolume ? (interCellFlowVolume / totalFlowVolume) * 100 : 0,
      average_cell_size: cells.length
        ? cells.reduce((sum, cell) => sum + cell.machine_ids.length, 0) / cells.length
        : 0,
      efficiency_score: analytics.latest_analysis?.efficiency || 0,
      total_flows: analytics.summary.flows,
    };
  }

  groupProductsAsGammes(products: Product[], machines: Machine[]) {
    return products.map((product) => ({
      product,
      operations: [...product.routes]
        .sort((a, b) => a.operation_order - b.operation_order)
        .map((route) => ({
          sequence: route.operation_order,
          machine: machines.find((machine) => machine.id === route.machine) || null,
          operation_time: route.duration_minutes,
          operation_name: route.operation_name,
        }))
        .filter((operation) => operation.machine),
    }));
  }

  getBaseUrl(): string {
    return API_BASE_URL;
  }
}

export const apiService = new ApiService();
