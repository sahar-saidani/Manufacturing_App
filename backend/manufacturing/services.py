import io
from dataclasses import dataclass

import numpy as np
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


class KingROC:
    def __init__(self, matrix, machine_names=None, product_names=None):
        self.matrix = np.array(matrix, dtype=int).copy()
        self.n_machines, self.n_products = self.matrix.shape if self.matrix.size else (0, 0)
        self.machine_names = machine_names if machine_names else [f"M{i + 1}" for i in range(self.n_machines)]
        self.product_names = product_names if product_names else [f"P{j + 1}" for j in range(self.n_products)]
        self.history = []

    def calculate_row_weights(self):
        col_weights = 2 ** np.arange(self.n_products - 1, -1, -1)
        return np.sum(self.matrix * col_weights, axis=1)

    def sort_rows(self):
        row_ed = self.calculate_row_weights()
        sorted_indices = np.argsort(-row_ed, kind="stable")
        return sorted_indices, row_ed[sorted_indices]

    def calculate_column_weights(self):
        row_weights = 2 ** np.arange(self.n_machines - 1, -1, -1)
        return np.sum(self.matrix.T * row_weights, axis=1)

    def sort_columns(self):
        col_ed = self.calculate_column_weights()
        sorted_indices = np.argsort(-col_ed, kind="stable")
        return sorted_indices, col_ed[sorted_indices]

    def cluster(self, max_iterations=10):
        iteration = 0
        previous_machine_names = list(self.machine_names)
        previous_product_names = list(self.product_names)

        while iteration < max_iterations:
            row_order, row_ed = self.sort_rows()
            self.matrix = self.matrix[row_order]
            self.machine_names = [self.machine_names[index] for index in row_order]

            col_order, col_ed = self.sort_columns()
            self.matrix = self.matrix[:, col_order]
            self.product_names = [self.product_names[index] for index in col_order]
            iteration += 1

            self.history.append(
                {
                    "iteration": iteration,
                    "row_order": row_order.tolist(),
                    "column_order": col_order.tolist(),
                    "row_ed": row_ed.tolist(),
                    "column_ed": col_ed.tolist(),
                }
            )

            if self.machine_names == previous_machine_names and self.product_names == previous_product_names:
                break

            previous_machine_names = list(self.machine_names)
            previous_product_names = list(self.product_names)

        return iteration, self.matrix.copy(), list(self.machine_names), list(self.product_names)

    def identify_cells(self):
        cells = []
        used_machines = set()

        for machine_index in range(self.n_machines):
            if machine_index in used_machines:
                continue

            machine_products = {product_index for product_index in range(self.n_products) if self.matrix[machine_index, product_index] == 1}
            if not machine_products:
                continue

            cell_machines = {machine_index}
            cell_products = set(machine_products)
            changed = True

            while changed:
                changed = False
                for candidate_machine in range(self.n_machines):
                    if candidate_machine in cell_machines:
                        continue
                    if any(self.matrix[candidate_machine, product_index] == 1 for product_index in cell_products):
                        cell_machines.add(candidate_machine)
                        for product_index in range(self.n_products):
                            if self.matrix[candidate_machine, product_index] == 1 and product_index not in cell_products:
                                cell_products.add(product_index)
                                changed = True

            sub_cells = self.split_cell(cell_machines, cell_products)
            if sub_cells:
                cells.extend(sub_cells)
            else:
                cells.append(self._build_cell(cell_machines, cell_products))

            used_machines.update(cell_machines)

        if not cells:
            return []

        cells.sort(key=lambda cell: min(cell["machines"]))
        return cells

    def split_cell(self, machines, products):
        if len(machines) <= 1:
            return []

        machine_list = sorted(machines)
        product_list = sorted(products)
        sub_matrix = self.matrix[np.ix_(machine_list, product_list)]
        similarity = np.zeros((len(machine_list), len(machine_list)))

        for row_index in range(len(machine_list)):
            for column_index in range(len(machine_list)):
                if row_index == column_index:
                    continue
                common = np.sum(np.logical_and(sub_matrix[row_index], sub_matrix[column_index]))
                total = np.sum(np.logical_or(sub_matrix[row_index], sub_matrix[column_index]))
                if total > 0:
                    similarity[row_index, column_index] = common / total

        groups = []
        visited = set()
        for machine_index in range(len(machine_list)):
            if machine_index in visited:
                continue
            group = {machine_index}
            for candidate_index in range(len(machine_list)):
                if candidate_index not in group and similarity[machine_index, candidate_index] > 0.5:
                    group.add(candidate_index)
            if len(group) < len(machine_list):
                groups.append(group)
                visited.update(group)

        if len(groups) <= 1:
            return []

        return [
            self._build_cell(
                {machine_list[index] for index in group},
                {
                    product_index
                    for index in group
                    for product_index in product_list
                    if self.matrix[machine_list[index], product_index] == 1
                },
            )
            for group in groups
        ]

    def _build_cell(self, machines, products):
        machine_list = sorted(machines)
        product_list = sorted(products)
        return {
            "machines": machine_list,
            "products": product_list,
            "machine_names": [self.machine_names[index] for index in machine_list],
            "product_names": [self.product_names[index] for index in product_list],
        }


def methode_king(matrice_initiale, machine_names=None, product_names=None, max_iterations=50):
    matrice = np.array(matrice_initiale, dtype=int)
    iterations = 0
    ordered_machine_names = list(machine_names) if machine_names else [f"M{i + 1}" for i in range(matrice.shape[0])]
    ordered_product_names = list(product_names) if product_names else [f"P{j + 1}" for j in range(matrice.shape[1])]
    anc_ordre_lignes = list(ordered_machine_names)
    anc_ordre_cols = list(ordered_product_names)

    while True:
        if iterations >= max_iterations:
            break

        n_lignes, n_cols = matrice.shape
        poids_cols = [2 ** (n_cols - 1 - j) for j in range(n_cols)]

        ed_lignes = []
        for i in range(n_lignes):
            ed_i = sum(matrice[i, j] * poids_cols[j] for j in range(n_cols))
            ed_lignes.append((ed_i, i))

        ed_lignes.sort(key=lambda x: x[0], reverse=True)
        nouvel_ordre_lignes = [x[1] for x in ed_lignes]
        matrice = matrice[nouvel_ordre_lignes, :]
        ordered_machine_names = [ordered_machine_names[index] for index in nouvel_ordre_lignes]

        n_lignes, n_cols = matrice.shape
        poids_lignes = [2 ** (n_lignes - 1 - i) for i in range(n_lignes)]

        ed_cols = []
        for j in range(n_cols):
            ed_j = sum(matrice[i, j] * poids_lignes[i] for i in range(n_lignes))
            ed_cols.append((ed_j, j))

        ed_cols.sort(key=lambda x: x[0], reverse=True)
        nouvel_ordre_cols = [x[1] for x in ed_cols]
        matrice = matrice[:, nouvel_ordre_cols]
        ordered_product_names = [ordered_product_names[index] for index in nouvel_ordre_cols]

        iterations += 1

        lignes_stables = anc_ordre_lignes == ordered_machine_names
        colonnes_stables = anc_ordre_cols == ordered_product_names
        if lignes_stables and colonnes_stables:
            break

        anc_ordre_lignes = list(ordered_machine_names)
        anc_ordre_cols = list(ordered_product_names)

    return iterations, matrice, ordered_machine_names, ordered_product_names


def apply_king_ordering(matrix, max_iterations=10):
    if not matrix:
        return 0, [], []

    machine_names = [str(index) for index in range(len(matrix))]
    product_names = [str(index) for index in range(len(matrix[0]))] if matrix[0] else []
    iterations, _, ordered_machine_names, ordered_product_names = methode_king(
        matrix,
        machine_names=machine_names,
        product_names=product_names,
        max_iterations=max_iterations,
    )
    row_order = [int(name) for name in ordered_machine_names]
    col_order = [int(name) for name in ordered_product_names]
    return iterations, row_order, col_order


def detect_cell_blocks_from_cells(cells):
    blocks = []
    for index, cell in enumerate(cells, start=1):
        row_start = min(cell["machines"])
        row_end = max(cell["machines"])
        column_start = min(cell["products"])
        column_end = max(cell["products"])
        blocks.append(
            {
                "row_start": row_start,
                "row_end": row_end,
                "column_start": column_start,
                "column_end": column_end,
                "cell_index": index,
                "machines": cell["machine_names"],
                "products": cell["product_names"],
            }
        )
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

    iterations, ordered_matrix_np, ordered_machine_codes, ordered_product_codes = methode_king(
        matrix,
        machine_names=[machine.code for machine in machines],
        product_names=[product.reference for product in products],
        max_iterations=50,
    )
    ordered_matrix = ordered_matrix_np.tolist()
    roc = KingROC(
        ordered_matrix,
        machine_names=ordered_machine_codes,
        product_names=ordered_product_codes,
    )
    cells = roc.identify_cells()
    blocks = detect_cell_blocks_from_cells(cells)
    exceptional, voids, efficiency = score_cells(ordered_matrix, blocks)
    machine_lookup = {machine.code: machine for machine in machines}
    ordered_machines = [machine_lookup[machine_code] for machine_code in ordered_machine_codes]
    ordered_products_lookup = {product.reference: product for product in products}
    ordered_products = [ordered_products_lookup[product_code] for product_code in ordered_product_codes]

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

    for block in blocks:
        for machine_code in block["machines"]:
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
