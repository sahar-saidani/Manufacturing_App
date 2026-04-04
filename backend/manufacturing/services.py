import io
from dataclasses import dataclass

import pandas as pd
from django.db import transaction

from .models import (
    KingAnalysis,
    Machine,
    MachineCellAssignment,
    MaterialFlow,
    OperationRoute,
    Product,
)


@dataclass
class KingAlgorithmResult:
    iterations: int
    machine_order: list
    product_order: list
    initial_matrix: list
    ordered_matrix: list
    cell_blocks: list
    exceptional_elements: int
    voids: int
    efficiency: float


def _binary_weight(bits):
    weight = 0
    size = len(bits)
    for index, bit in enumerate(bits):
        weight += int(bit) * (2 ** (size - index - 1))
    return weight


def build_incidence_matrix(company):
    machines = list(company.machines.order_by("code"))
    products = list(company.products.prefetch_related("routes__machine").order_by("reference"))
    machine_index = {machine.id: idx for idx, machine in enumerate(machines)}
    matrix = [[0 for _ in products] for _ in machines]

    for product_idx, product in enumerate(products):
        for route in product.routes.all():
            row = machine_index.get(route.machine_id)
            if row is not None:
                matrix[row][product_idx] = 1

    return machines, products, matrix


def _reorder_matrix(matrix, row_order, col_order):
    return [[matrix[row_idx][col_idx] for col_idx in col_order] for row_idx in row_order]


def _binary_equivalent(bits):
    return sum(int(bit) * (2 ** (len(bits) - index - 1)) for index, bit in enumerate(bits))


def _column_bits(matrix, column_index):
    return [row[column_index] for row in matrix]


def apply_king_ordering(matrix, max_iterations=50):
    if not matrix:
        return 0, [], []

    row_order = list(range(len(matrix)))
    col_order = list(range(len(matrix[0]))) if matrix[0] else []
    current = [row[:] for row in matrix]
    previous_row_order = None
    previous_col_order = None

    for iteration in range(1, max_iterations + 1):
        row_weights = [_binary_equivalent(row) for row in current]
        sorted_rows = sorted(range(len(current)), key=lambda idx: row_weights[idx], reverse=True)
        current = [current[idx] for idx in sorted_rows]
        row_order = [row_order[idx] for idx in sorted_rows]

        if current and current[0]:
            col_weights = [_binary_equivalent(_column_bits(current, col_idx)) for col_idx in range(len(current[0]))]
            sorted_cols = sorted(range(len(current[0])), key=lambda idx: col_weights[idx], reverse=True)
            current = [[row[col_idx] for col_idx in sorted_cols] for row in current]
            col_order = [col_order[idx] for idx in sorted_cols]

        if previous_row_order == row_order and previous_col_order == col_order:
            return iteration, row_order, col_order

        previous_row_order = row_order[:]
        previous_col_order = col_order[:]

    return max_iterations, row_order, col_order


def detect_cell_blocks(ordered_matrix):
    row_ranges = []
    for row_idx, row in enumerate(ordered_matrix):
        ones = [idx for idx, value in enumerate(row) if value == 1]
        if ones:
            row_ranges.append((row_idx, min(ones), max(ones)))

    if not row_ranges:
        return []

    blocks = []
    current = {
        "row_start": row_ranges[0][0],
        "row_end": row_ranges[0][0],
        "column_start": row_ranges[0][1],
        "column_end": row_ranges[0][2],
    }

    for row_idx, col_start, col_end in row_ranges[1:]:
        overlaps = col_start <= current["column_end"] + 1 and col_end >= current["column_start"] - 1
        if overlaps:
            current["row_end"] = row_idx
            current["column_start"] = min(current["column_start"], col_start)
            current["column_end"] = max(current["column_end"], col_end)
        else:
            blocks.append(current)
            current = {
                "row_start": row_idx,
                "row_end": row_idx,
                "column_start": col_start,
                "column_end": col_end,
            }

    blocks.append(current)
    for index, block in enumerate(blocks, start=1):
        block["cell_index"] = index
    return blocks


def score_cells(ordered_matrix, blocks):
    exceptional = 0
    voids = 0
    inside_ones = 0
    inside_total = 0

    for block in blocks:
        for row_idx in range(block["row_start"], block["row_end"] + 1):
            for col_idx in range(block["column_start"], block["column_end"] + 1):
                inside_total += 1
                value = ordered_matrix[row_idx][col_idx]
                if value == 1:
                    inside_ones += 1
                else:
                    voids += 1

    for row_idx, row in enumerate(ordered_matrix):
        for col_idx, value in enumerate(row):
            if value != 1:
                continue
            in_block = any(
                block["row_start"] <= row_idx <= block["row_end"]
                and block["column_start"] <= col_idx <= block["column_end"]
                for block in blocks
            )
            if not in_block:
                exceptional += 1

    efficiency = round((inside_ones / inside_total) * 100, 2) if inside_total else 0
    return exceptional, voids, efficiency


@transaction.atomic
def run_king_analysis(company):
    machines, products, matrix = build_incidence_matrix(company)
    if not machines or not products:
        raise ValueError("At least one machine and one product with gammes are required.")

    iterations, row_order, col_order = apply_king_ordering(matrix)
    ordered_matrix = _reorder_matrix(matrix, row_order, col_order)
    blocks = detect_cell_blocks(ordered_matrix)
    exceptional, voids, efficiency = score_cells(ordered_matrix, blocks)

    ordered_machines = [machines[idx] for idx in row_order]
    ordered_products = [products[idx] for idx in col_order]

    analysis = KingAnalysis.objects.create(
        company=company,
        iterations=iterations,
        machine_order=[machine.code for machine in ordered_machines],
        product_order=[product.reference for product in ordered_products],
        initial_matrix=matrix,
        ordered_matrix=ordered_matrix,
        cell_blocks=blocks,
        exceptional_elements=exceptional,
        voids=voids,
        efficiency=efficiency,
    )

    machine_lookup = {machine.code: machine for machine in ordered_machines}
    for block in blocks:
        machine_codes = analysis.machine_order[block["row_start"] : block["row_end"] + 1]
        for machine_code in machine_codes:
            machine = machine_lookup[machine_code]
            machine.current_cell = block["cell_index"]
            machine.save(update_fields=["current_cell", "updated_at"])
            MachineCellAssignment.objects.create(
                analysis=analysis,
                machine=machine,
                cell_index=block["cell_index"],
                block_row_start=block["row_start"],
                block_row_end=block["row_end"],
                block_column_start=block["column_start"],
                block_column_end=block["column_end"],
            )

    return analysis


def _normalize_columns(dataframe):
    dataframe.columns = [str(col).strip().lower().replace(" ", "_") for col in dataframe.columns]
    return dataframe


def _read_dataframes(uploaded_file):
    content = uploaded_file.read()
    filename = uploaded_file.name.lower()

    if filename.endswith(".csv"):
        return {"csv": _normalize_columns(pd.read_csv(io.BytesIO(content)))}

    workbook = pd.read_excel(io.BytesIO(content), sheet_name=None)
    return {name.lower(): _normalize_columns(df) for name, df in workbook.items()}


def _machine_from_code(company, code, machine_name=""):
    machine, _ = Machine.objects.get_or_create(
        company=company,
        code=str(code).strip(),
        defaults={"name": machine_name or str(code).strip()},
    )
    return machine


def _first_non_empty(row, keys, default=""):
    for key in keys:
        value = row.get(key)
        if pd.isna(value):
            continue
        text = str(value).strip()
        if text:
            return text
    return default


def _parse_numeric(value, default=0, cast_type=float):
    if pd.isna(value):
        return default
    text = str(value).strip()
    if not text:
        return default
    try:
        return cast_type(float(text.replace(",", ".")))
    except (TypeError, ValueError):
        return default


def _split_sequence(raw_value):
    if pd.isna(raw_value):
        return []
    normalized = str(raw_value).replace(";", "-").replace(",", "-").replace("/", "-")
    return [item.strip() for item in normalized.split("-") if item and item.strip()]


@transaction.atomic
def import_company_data(company, uploaded_file):
    dataframes = _read_dataframes(uploaded_file)
    imported = {"machines": 0, "products": 0, "routes": 0, "flows": 0}

    for sheet_name, dataframe in dataframes.items():
        if dataframe.empty:
            continue

        columns = set(dataframe.columns)
        machine_columns = {"code", "name"}.issubset(columns) or {"poste", "fonction"}.issubset(columns)
        if machine_columns:
            for _, row in dataframe.iterrows():
                code = _first_non_empty(row, ["code", "poste"])
                if not code:
                    continue
                _, created = Machine.objects.update_or_create(
                    company=company,
                    code=code,
                    defaults={
                        "name": _first_non_empty(row, ["name", "fonction"], default=code),
                        "description": _first_non_empty(row, ["description"], default=""),
                    },
                )
                if created:
                    imported["machines"] += 1
            continue

        has_product_header = bool({"reference", "name", "produit"}.intersection(columns))
        has_route_columns = {"product_reference", "machine_code", "operation_order"}.issubset(columns)
        has_gamme_column = any(col in columns for col in ["gamme", "routing", "route", "circuit"])
        if has_route_columns or (has_product_header and has_gamme_column):
            for _, row in dataframe.iterrows():
                reference = _first_non_empty(row, ["product_reference", "reference", "produit"])
                if not reference:
                    continue

                product, created = Product.objects.update_or_create(
                    company=company,
                    reference=reference,
                    defaults={
                        "name": _first_non_empty(row, ["name", "produit"], default=reference),
                        "batch_size": _parse_numeric(row.get("batch_size", row.get("lot", 1)), default=1, cast_type=int),
                        "annual_demand": _parse_numeric(row.get("annual_demand", row.get("demand", 0)), default=0, cast_type=int),
                    },
                )
                if created:
                    imported["products"] += 1

                if has_route_columns:
                    machine = _machine_from_code(
                        company,
                        row.get("machine_code"),
                        machine_name=str(row.get("machine_name", row.get("machine_code", ""))).strip(),
                    )
                    OperationRoute.objects.update_or_create(
                        product=product,
                        operation_order=int(row.get("operation_order", 1)),
                        defaults={
                            "machine": machine,
                            "operation_name": str(row.get("operation_name", "")).strip(),
                            "duration_minutes": float(row.get("duration_minutes", 0) or 0),
                        },
                    )
                    imported["routes"] += 1
                else:
                    gamme_value = _first_non_empty(row, ["gamme", "routing", "route"])
                    if not gamme_value:
                        gamme_value = _first_non_empty(row, ["circuit"])
                    sequence = _split_sequence(gamme_value)
                    for order, machine_code in enumerate(sequence, start=1):
                        machine = _machine_from_code(company, machine_code)
                        OperationRoute.objects.update_or_create(
                            product=product,
                            operation_order=order,
                            defaults={
                                "machine": machine,
                                "operation_name": _first_non_empty(row, ["ligne"], default=f"Op {order}"),
                            },
                        )
                        imported["routes"] += 1
            continue

        if {"from_machine", "to_machine"}.issubset(columns):
            for _, row in dataframe.iterrows():
                from_machine = _machine_from_code(company, row.get("from_machine"))
                to_machine = _machine_from_code(company, row.get("to_machine"))
                product = None
                product_reference = str(row.get("product_reference", row.get("reference", ""))).strip()
                if product_reference:
                    product = Product.objects.filter(company=company, reference=product_reference).first()
                MaterialFlow.objects.update_or_create(
                    company=company,
                    product=product,
                    from_machine=from_machine,
                    to_machine=to_machine,
                    defaults={"ul_value": float(row.get("ul", row.get("ul_value", row.get("flow_units", 0))) or 0)},
                )
                imported["flows"] += 1

    return imported
