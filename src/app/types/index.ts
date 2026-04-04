export interface Company {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  machine_count: number;
  product_count: number;
}

export interface Machine {
  id: number;
  company: number;
  company_name: string;
  code: string;
  name: string;
  description: string;
  current_cell: number | null;
  created_at: string;
  updated_at: string;
}

export interface OperationRoute {
  id: number;
  product: number;
  machine: number;
  machine_code: string;
  machine_name: string;
  operation_order: number;
  operation_name: string;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  company: number;
  reference: string;
  name: string;
  batch_size: number;
  annual_demand: number;
  gamme: string[];
  routes: OperationRoute[];
  created_at: string;
  updated_at: string;
}

export interface MaterialFlow {
  id: number;
  company: number;
  product: number | null;
  product_reference: string | null;
  from_machine: number;
  from_machine_code: string;
  to_machine: number;
  to_machine_code: string;
  ul_value: number;
  created_at: string;
  updated_at: string;
}

export interface CellBlock {
  row_start: number;
  row_end: number;
  column_start: number;
  column_end: number;
  cell_index: number;
}

export interface MachineAssignment {
  id: number;
  analysis: number;
  machine: number;
  machine_code: string;
  machine_name: string;
  cell_index: number;
  block_row_start: number;
  block_row_end: number;
  block_column_start: number;
  block_column_end: number;
}

export interface KingAlgorithmResult {
  id: number;
  company: number;
  iterations: number;
  machine_order: string[];
  product_order: string[];
  initial_matrix: number[][];
  ordered_matrix: number[][];
  cell_blocks: CellBlock[];
  exceptional_elements: number;
  voids: number;
  efficiency: number;
  machine_assignments: MachineAssignment[];
  created_at: string;
  updated_at: string;
}

export interface CompanyAnalytics {
  company: Company;
  summary: {
    machines: number;
    products: number;
    gammes: number;
    flows: number;
    ul_total: number;
  };
  incidence: {
    machine_codes: string[];
    product_references: string[];
    matrix: number[][];
  };
  machines: Machine[];
  products: Product[];
  flows: MaterialFlow[];
  latest_analysis: KingAlgorithmResult | null;
}

export interface Cell {
  id: number;
  code: string;
  name: string;
  machine_ids: number[];
  color: string;
  row_start: number;
  row_end: number;
  column_start: number;
  column_end: number;
}

export interface DashboardMetrics {
  total_machines: number;
  total_products: number;
  total_cells: number;
  inter_cell_flow_percentage: number;
  average_cell_size: number;
  efficiency_score: number;
  total_flows: number;
}
