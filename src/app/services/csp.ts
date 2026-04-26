import type { Cell, CompanyAnalytics, KingAlgorithmResult, Product } from '../types';

export type OrderedMatrixRow = {
  product: string;
  values: number[];
};

export type CellInsight = {
  id: number;
  code: string;
  color: string;
  machines: string[];
  products: string[];
  machineIds: number[];
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
  matrix: number[][];
  residual: boolean;
};

export type ChainonLink = {
  from: string;
  to: string;
  fromIndex: number;
  toIndex: number;
  frequency: number;
  strong: boolean;
};

export type ChainonPieceSequence = {
  product: string;
  machines: string[];
};

export type ChainonInsight = {
  cell: CellInsight;
  machines: string[];
  products: string[];
  sequences: ChainonPieceSequence[];
  frequencyMatrix: number[][];
  links: ChainonLink[];
  strongThreshold: number;
};

export function getOrderedMatrixRows(result: KingAlgorithmResult | null): OrderedMatrixRow[] {
  if (!result) {
    return [];
  }

  return result.product_order.map((product, index) => ({
    product,
    values: result.ordered_matrix[index] ?? [],
  }));
}

export function getCellInsights(analytics: CompanyAnalytics | null, cells: Cell[]): CellInsight[] {
  const result = analytics?.latest_analysis;
  if (!analytics || !result) {
    return [];
  }

  return cells.map((cell) => {
    const machines = cell.machines?.length ? cell.machines : result.machine_order.slice(cell.column_start, cell.column_end + 1);
    const products = cell.products?.length ? cell.products : result.product_order.slice(cell.row_start, cell.row_end + 1);
    const matrix = result.ordered_matrix
      .slice(cell.row_start, cell.row_end + 1)
      .map((row) => row.slice(cell.column_start, cell.column_end + 1));

    return {
      id: cell.id,
      code: cell.code,
      color: cell.color,
      machines,
      products,
      machineIds: cell.machine_ids,
      rowStart: cell.row_start,
      rowEnd: cell.row_end,
      columnStart: cell.column_start,
      columnEnd: cell.column_end,
      matrix,
      residual: Boolean(cell.residual),
    };
  });
}

export function getExceptionalEntries(result: KingAlgorithmResult | null, cells: CellInsight[]) {
  if (!result) {
    return [];
  }

  const exceptions: Array<{ product: string; machine: string; cellCodes: string[] }> = [];

  result.ordered_matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value !== 1) {
        return;
      }

      const hostCell = cells.find(
        (cell) =>
          rowIndex >= cell.rowStart &&
          rowIndex <= cell.rowEnd &&
          columnIndex >= cell.columnStart &&
          columnIndex <= cell.columnEnd,
      );

      if (!hostCell) {
        const touchingCells = cells
          .filter(
            (cell) =>
              (rowIndex >= cell.rowStart && rowIndex <= cell.rowEnd) ||
              (columnIndex >= cell.columnStart && columnIndex <= cell.columnEnd),
          )
          .map((cell) => cell.code);

        exceptions.push({
          product: result.product_order[rowIndex],
          machine: result.machine_order[columnIndex],
          cellCodes: touchingCells,
        });
      }
    });
  });

  return exceptions;
}

function getProductSequence(product: Product, machineCodeSet: Set<string>) {
  return [...product.routes]
    .sort((a, b) => a.operation_order - b.operation_order)
    .map((route) => route.machine_code)
    .filter((machineCode) => machineCodeSet.has(machineCode));
}

export function getChainonInsight(analytics: CompanyAnalytics | null, cell: CellInsight | null): ChainonInsight | null {
  if (!analytics || !cell) {
    return null;
  }

  const machines = cell.machines;
  const products = analytics.products.filter((product) => cell.products.includes(product.reference));
  const machineCodeSet = new Set(machines);
  const sequences = products
    .map((product) => ({
      product: product.reference,
      machines: getProductSequence(product, machineCodeSet),
    }))
    .filter((sequence) => sequence.machines.length > 0);

  const frequencyMatrix = Array.from({ length: machines.length }, () => new Array(machines.length).fill(0));

  sequences.forEach((sequence) => {
    for (let index = 0; index < sequence.machines.length - 1; index += 1) {
      const fromIndex = machines.indexOf(sequence.machines[index]);
      const toIndex = machines.indexOf(sequence.machines[index + 1]);
      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
        frequencyMatrix[fromIndex][toIndex] += 1;
      }
    }
  });

  const rawLinks: Omit<ChainonLink, 'strong'>[] = [];
  for (let fromIndex = 0; fromIndex < machines.length; fromIndex += 1) {
    for (let toIndex = fromIndex + 1; toIndex < machines.length; toIndex += 1) {
      const frequency = frequencyMatrix[fromIndex][toIndex] + frequencyMatrix[toIndex][fromIndex];
      if (frequency > 0) {
        rawLinks.push({
          from: machines[fromIndex],
          to: machines[toIndex],
          fromIndex,
          toIndex,
          frequency,
        });
      }
    }
  }

  const strongestFrequency = rawLinks.length ? Math.max(...rawLinks.map((link) => link.frequency)) : 0;
  const strongThreshold = strongestFrequency > 0 ? strongestFrequency * 0.5 : 0;
  const links = rawLinks
    .map((link) => ({
      ...link,
      strong: strongestFrequency > 0 ? link.frequency >= strongThreshold : false,
    }))
    .sort((left, right) => right.frequency - left.frequency);

  return {
    cell,
    machines,
    products: cell.products,
    sequences,
    frequencyMatrix,
    links,
    strongThreshold,
  };
}

export function getFlowSummary(analytics: CompanyAnalytics | null, cells: Cell[]) {
  if (!analytics) {
    return [];
  }

  const cellById = new Map(cells.map((cell) => [cell.id, cell]));

  return analytics.flows
    .map((flow) => {
      const fromMachine = analytics.machines.find((machine) => machine.id === flow.from_machine);
      const toMachine = analytics.machines.find((machine) => machine.id === flow.to_machine);
      const fromCell = fromMachine?.current_cell ? cellById.get(fromMachine.current_cell) : undefined;
      const toCell = toMachine?.current_cell ? cellById.get(toMachine.current_cell) : undefined;

      return {
        flow,
        fromMachine,
        toMachine,
        fromCell,
        toCell,
      };
    })
    .filter(
      (entry): entry is NonNullable<typeof entry> =>
        Boolean(entry.fromMachine && entry.toMachine && entry.fromCell && entry.toCell),
    );
}
