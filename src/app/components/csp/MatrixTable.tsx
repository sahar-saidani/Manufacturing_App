type MatrixTableProps = {
  rowLabels: string[];
  columnLabels: string[];
  data: number[][];
  title?: string;
  highlightedRows?: number[];
  highlightedColumns?: number[];
  cellRanges?: Array<{
    rowStart: number;
    rowEnd: number;
    columnStart: number;
    columnEnd: number;
    color?: string;
    residual?: boolean;
  }>;
  rowHeaderLabel?: string;
};

function isInsideRange(
  rowIndex: number,
  columnIndex: number,
  cellRanges: NonNullable<MatrixTableProps['cellRanges']>,
) {
  return cellRanges.find(
    (range) =>
      rowIndex >= range.rowStart &&
      rowIndex <= range.rowEnd &&
      columnIndex >= range.columnStart &&
      columnIndex <= range.columnEnd,
  );
}

export function MatrixTable({
  rowLabels,
  columnLabels,
  data,
  title,
  highlightedRows = [],
  highlightedColumns = [],
  cellRanges = [],
  rowHeaderLabel = 'Produit',
}: MatrixTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#2a3045] bg-[#13161e]">
      {title ? (
        <div className="border-b border-[#2a3045] px-4 py-3 text-sm font-semibold text-white">{title}</div>
      ) : null}

      <div className="max-h-[420px] overflow-auto">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 border border-[#2a3045] bg-[#1a1e2a] px-4 py-3 text-left font-semibold text-[#9299b0]">
                {rowHeaderLabel}
              </th>
              {columnLabels.map((label, columnIndex) => (
                <th
                  key={`${label}-${columnIndex}`}
                  className={`sticky top-0 z-10 border border-[#2a3045] bg-[#1a1e2a] px-4 py-3 font-mono text-[11px] ${
                    highlightedColumns.includes(columnIndex) ? 'text-emerald-400' : 'text-[#4f8ef7]'
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((label, rowIndex) => (
              <tr key={`${label}-${rowIndex}`}>
                <td
                  className={`sticky left-0 z-10 border border-[#2a3045] bg-[#1a1e2a] px-4 py-3 text-left font-mono font-semibold ${
                    highlightedRows.includes(rowIndex) ? 'text-emerald-400' : 'text-[#b993ff]'
                  }`}
                >
                  {label}
                </td>
                {(data[rowIndex] ?? []).map((value, columnIndex) => {
                  const range = isInsideRange(rowIndex, columnIndex, cellRanges);
                  const backgroundColor =
                    value === 1
                      ? range?.residual
                        ? '#f59e0b44'
                        : range?.color
                          ? `${range.color}22`
                          : '#4f8ef733'
                      : range?.residual
                        ? '#f59e0b12'
                        : range?.color
                          ? `${range.color}10`
                          : 'transparent';
                  const borderColor = range?.residual ? '#f59e0b' : '#2a3045';

                  return (
                    <td
                      key={`${rowIndex}-${columnIndex}`}
                      className={`border px-4 py-3 text-center font-mono text-[11px] ${
                        value === 1 ? 'font-bold text-white' : 'text-[#636980]'
                      }`}
                      style={{ backgroundColor, borderColor }}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
