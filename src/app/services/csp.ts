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

export type ChainonPlacement = {
  machine: string;
  x: number;
  y: number;
  connectivity: number;
};

export type ChainonInsight = {
  cell: CellInsight;
  machines: string[];
  products: string[];
  sequences: ChainonPieceSequence[];
  structureMatrix: number[][];
  frequencyMatrix: number[][];
  connectivity: Array<{
    machine: string;
    score: number;
  }>;
  director: string | null;
  layout: ChainonPlacement[];
  links: ChainonLink[];
  strongThreshold: number;
  offGridLinks: number;
  crossings: number;
  totalLinks: number;
  ro: number;
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

function getNeighborOffsets(radius: number) {
  const offsets: Array<{ x: number; y: number; distance: number }> = [];

  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x === 0 && y === 0) {
        continue;
      }
      offsets.push({
        x,
        y,
        distance: Math.max(Math.abs(x), Math.abs(y)),
      });
    }
  }

  return offsets.sort((left, right) => {
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }
    if (Math.abs(left.y) !== Math.abs(right.y)) {
      return Math.abs(left.y) - Math.abs(right.y);
    }
    return Math.abs(left.x) - Math.abs(right.x);
  });
}

function countAdjacentLinks(structureMatrix: number[][], machineIndex: number, candidateIndex: number) {
  return structureMatrix[machineIndex].reduce((count, value, index) => {
    if (!value || index === candidateIndex) {
      return count;
    }
    return count + structureMatrix[candidateIndex][index];
  }, 0);
}

function buildChainonLayout(
  machines: string[],
  structureMatrix: number[][],
  connectivity: Array<{ machine: string; score: number }>,
) {
  if (!machines.length) {
    return [];
  }

  const machineIndex = new Map(machines.map((machine, index) => [machine, index]));
  const placements = new Map<string, ChainonPlacement>();
  const occupied = new Set<string>();
  const orderedByConnectivity = [...connectivity].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.machine.localeCompare(right.machine);
  });
  const director = orderedByConnectivity[0]?.machine ?? machines[0];
  const directorIndex = machineIndex.get(director) ?? 0;

  placements.set(director, {
    machine: director,
    x: 0,
    y: 0,
    connectivity: connectivity.find((entry) => entry.machine === director)?.score ?? 0,
  });
  occupied.add('0:0');

  const neighborOffsets = getNeighborOffsets(4);

  orderedByConnectivity.forEach(({ machine, score }) => {
    if (placements.has(machine)) {
      return;
    }

    const currentIndex = machineIndex.get(machine);
    if (currentIndex == null) {
      return;
    }

    const anchors = machines
      .map((anchorMachine, anchorIndex) => ({
        anchorMachine,
        anchorIndex,
        connected: structureMatrix[currentIndex][anchorIndex] === 1,
        placement: placements.get(anchorMachine) ?? null,
        anchorConnectivity: connectivity.find((entry) => entry.machine === anchorMachine)?.score ?? 0,
      }))
      .filter((entry) => entry.connected && entry.placement)
      .sort((left, right) => {
        if (right.anchorConnectivity !== left.anchorConnectivity) {
          return right.anchorConnectivity - left.anchorConnectivity;
        }
        return left.anchorMachine.localeCompare(right.anchorMachine);
      });

    const fallbackAnchor = placements.get(director) ?? null;
    const referenceAnchors = anchors.length ? anchors : fallbackAnchor ? [{
      anchorMachine: director,
      anchorIndex: directorIndex,
      connected: false,
      placement: fallbackAnchor,
      anchorConnectivity: connectivity.find((entry) => entry.machine === director)?.score ?? 0,
    }] : [];

    let bestCandidate: { x: number; y: number; quality: number; tieBreaker: number } | null = null;

    referenceAnchors.forEach((anchor) => {
      const anchorPlacement = anchor.placement;
      if (!anchorPlacement) {
        return;
      }

      neighborOffsets.forEach((offset) => {
        const x = anchorPlacement.x + offset.x;
        const y = anchorPlacement.y + offset.y;
        const key = `${x}:${y}`;
        if (occupied.has(key)) {
          return;
        }

        let quality = 0;
        placements.forEach((placedMachine, placedCode) => {
          const placedIndex = machineIndex.get(placedCode);
          if (placedIndex == null || structureMatrix[currentIndex][placedIndex] !== 1) {
            return;
          }

          const distance = Math.max(Math.abs(x - placedMachine.x), Math.abs(y - placedMachine.y));
          if (distance <= 1) {
            quality += 4;
          } else if (distance === 2) {
            quality += 1;
          } else {
            quality -= distance;
          }
        });

        quality += countAdjacentLinks(structureMatrix, currentIndex, anchor.anchorIndex);
        const tieBreaker = Math.abs(x) + Math.abs(y);

        if (
          !bestCandidate ||
          quality > bestCandidate.quality ||
          (quality === bestCandidate.quality && tieBreaker < bestCandidate.tieBreaker)
        ) {
          bestCandidate = { x, y, quality, tieBreaker };
        }
      });
    });

    const chosenPosition = bestCandidate ?? { x: placements.size, y: 0, quality: 0, tieBreaker: placements.size };
    placements.set(machine, {
      machine,
      x: chosenPosition.x,
      y: chosenPosition.y,
      connectivity: score,
    });
    occupied.add(`${chosenPosition.x}:${chosenPosition.y}`);
  });

  return machines
    .map((machine) => placements.get(machine))
    .filter((placement): placement is ChainonPlacement => Boolean(placement));
}

function isAdjacentPlacement(left: ChainonPlacement, right: ChainonPlacement) {
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y)) <= 1;
}

function getOrientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const value = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (value === 0) {
    return 0;
  }
  return value > 0 ? 1 : 2;
}

function segmentsCross(a: ChainonPlacement, b: ChainonPlacement, c: ChainonPlacement, d: ChainonPlacement) {
  const abSharesEndpoint = a.machine === c.machine || a.machine === d.machine || b.machine === c.machine || b.machine === d.machine;
  if (abSharesEndpoint) {
    return false;
  }

  const orientation1 = getOrientation(a.x, a.y, b.x, b.y, c.x, c.y);
  const orientation2 = getOrientation(a.x, a.y, b.x, b.y, d.x, d.y);
  const orientation3 = getOrientation(c.x, c.y, d.x, d.y, a.x, a.y);
  const orientation4 = getOrientation(c.x, c.y, d.x, d.y, b.x, b.y);

  return orientation1 !== orientation2 && orientation3 !== orientation4;
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
  const structureMatrix = Array.from({ length: machines.length }, () => new Array(machines.length).fill(0));

  sequences.forEach((sequence) => {
    for (let index = 0; index < sequence.machines.length - 1; index += 1) {
      const fromIndex = machines.indexOf(sequence.machines[index]);
      const toIndex = machines.indexOf(sequence.machines[index + 1]);
      if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
        frequencyMatrix[fromIndex][toIndex] += 1;
        structureMatrix[fromIndex][toIndex] = 1;
        structureMatrix[toIndex][fromIndex] = 1;
      }
    }
  });

  const connectivity = machines.map((machine, index) => ({
    machine,
    score: structureMatrix[index].reduce((sum, value) => sum + value, 0),
  }));
  const director = [...connectivity]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.machine.localeCompare(right.machine);
    })[0]?.machine ?? null;
  const layout = buildChainonLayout(machines, structureMatrix, connectivity);
  const placementByMachine = new Map(layout.map((placement) => [placement.machine, placement]));

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
  const totalLinks = links.length;
  const offGridLinks = links.reduce((count, link) => {
    const fromPlacement = placementByMachine.get(link.from);
    const toPlacement = placementByMachine.get(link.to);
    if (!fromPlacement || !toPlacement) {
      return count + 1;
    }
    return count + (isAdjacentPlacement(fromPlacement, toPlacement) ? 0 : 1);
  }, 0);

  let crossings = 0;
  for (let index = 0; index < links.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < links.length; nextIndex += 1) {
      const left = links[index];
      const right = links[nextIndex];
      const fromLeft = placementByMachine.get(left.from);
      const toLeft = placementByMachine.get(left.to);
      const fromRight = placementByMachine.get(right.from);
      const toRight = placementByMachine.get(right.to);

      if (!fromLeft || !toLeft || !fromRight || !toRight) {
        continue;
      }

      if (segmentsCross(fromLeft, toLeft, fromRight, toRight)) {
        crossings += 1;
      }
    }
  }

  const ro = totalLinks > 0 ? Math.max(0, 1 - (offGridLinks + crossings) / totalLinks) : 1;

  return {
    cell,
    machines,
    products: cell.products,
    sequences,
    structureMatrix,
    frequencyMatrix,
    connectivity,
    director,
    layout,
    links,
    strongThreshold,
    offGridLinks,
    crossings,
    totalLinks,
    ro,
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
