import io
from dataclasses import dataclass
from itertools import combinations

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


def build_product_machine_matrix(company):
    machines = list(company.machines.order_by("code"))
    products = list(company.products.prefetch_related("routes__machine").order_by("reference"))

    machine_index = {machine.id: idx for idx, machine in enumerate(machines)}
    matrix = [[0 for _ in machines] for _ in products]

    for product_idx, product in enumerate(products):
        for route in product.routes.all():
            column = machine_index.get(route.machine_id)
            if column is not None:
                matrix[product_idx][column] = 1

    return products, machines, matrix


def roc_algorithm(M_init, row_labels=None, col_labels=None, max_iterations=100):
    M = [list(row) for row in M_init]
    n_rows = len(M)
    n_cols = len(M[0]) if M else 0

    if row_labels is None:
        row_labels = [f"R{i + 1}" for i in range(n_rows)]
    if col_labels is None:
        col_labels = [f"C{j + 1}" for j in range(n_cols)]

    row_order = list(row_labels)
    col_order = list(col_labels)

    def compute_l1(current_matrix, n_r, n_c):
        l1 = [0] * n_c
        for i in range(n_r):
            for j in range(n_c):
                l1[j] += (2 ** (n_r - i - 1)) * current_matrix[i][j]
        return l1

    def compute_l(current_matrix, n_r, n_c):
        l = [0] * n_r
        for i in range(n_r):
            for j in range(n_c):
                l[i] += (2 ** (n_c - j - 1)) * current_matrix[i][j]
        return l

    def sort_cols_by_l1(current_matrix, current_col_order, n_r, n_c):
        l1 = compute_l1(current_matrix, n_r, n_c)
        order = sorted(range(n_c), key=lambda j: l1[j], reverse=True)
        matrix_new = [[current_matrix[i][order[j]] for j in range(n_c)] for i in range(n_r)]
        labels_new = [current_col_order[j] for j in order]
        return matrix_new, labels_new, [l1[order[j]] for j in range(n_c)]

    def sort_rows_by_l(current_matrix, current_row_order, n_r, n_c):
        l = compute_l(current_matrix, n_r, n_c)
        order = sorted(range(n_r), key=lambda i: l[i], reverse=True)
        matrix_new = [current_matrix[order[i]][:] for i in range(n_r)]
        labels_new = [current_row_order[i] for i in order]
        return matrix_new, labels_new, [l[order[i]] for i in range(n_r)]

    iteration = 0
    while True:
        iteration += 1
        M_prev = [row[:] for row in M]
        row_prev = list(row_order)
        col_prev = list(col_order)

        M, col_order, _ = sort_cols_by_l1(M, col_order, n_rows, n_cols)
        M, row_order, _ = sort_rows_by_l(M, row_order, n_rows, n_cols)

        if M == M_prev and row_order == row_prev and col_order == col_prev:
            break

        if iteration >= max_iterations:
            break

    return np.array(M, dtype=int), row_order, col_order, iteration


def king_algorithm(M_input, pieces, machines):
    nr = len(M_input)
    nc = len(M_input[0])
    M = [row[:] for row in M_input]
    col_order = list(range(nc))
    row_order = list(range(nr))

    def compute_l1(M):
        l1 = [0] * nc
        for i in range(nr):
            for j in range(nc):
                l1[j] += (2 ** (nr - i - 1)) * M[i][j]
        return l1

    def compute_l(M):
        l = [0] * nr
        for i in range(nr):
            for j in range(nc):
                l[i] += (2 ** (nc - j - 1)) * M[i][j]
        return l

    iteration = 0
    while True:
        iteration += 1
        M_prev = [row[:] for row in M]

        # --- Tri des colonnes par l1 décroissant ---
        l1 = compute_l1(M)
        c_ord = sorted(range(nc), key=lambda j: l1[j], reverse=True)
        M = [[M[i][j] for j in c_ord] for i in range(nr)]
        col_order = [col_order[j] for j in c_ord]

        # --- Tri des lignes par l décroissant ---
        l = compute_l(M)
        r_ord = sorted(range(nr), key=lambda i: l[i], reverse=True)
        M = [M[i] for i in r_ord]
        row_order = [row_order[i] for i in r_ord]

        if M == M_prev:
            break

    final_pieces   = [pieces[i]   for i in row_order]
    final_machines = [machines[j] for j in col_order]

    return {
        "matrix":        M,
        "pieces":        final_pieces,
        "machines":      final_machines,
        "iterations":    iteration,
        "row_order":     row_order,
        "col_order":     col_order,
    }


def rank_order_clustering(matrix, row_labels=None, col_labels=None, max_iterations=100):
    result = king_algorithm(
        [list(row) for row in matrix],
        pieces=list(row_labels) if row_labels is not None else [f"R{i + 1}" for i in range(len(matrix))],
        machines=list(col_labels) if col_labels is not None else [f"C{j + 1}" for j in range(len(matrix[0]))],
    )
    return (
        result["iterations"],
        np.array(result["matrix"], dtype=int),
        result["pieces"],
        result["machines"],
    )


def methode_king(matrice_initiale, machine_names=None, product_names=None, max_iterations=50):
    matrice = np.array(matrice_initiale, dtype=int)

    product_labels = list(product_names) if product_names else [f"P{i + 1}" for i in range(matrice.shape[0])]
    machine_labels = list(machine_names) if machine_names else [f"M{j + 1}" for j in range(matrice.shape[1])]

    iterations, ordered_matrix, ordered_rows, ordered_columns = rank_order_clustering(
        matrice,
        row_labels=product_labels,
        col_labels=machine_labels,
        max_iterations=max_iterations,
    )

    return (
        iterations,
        ordered_matrix,
        ordered_rows,
        ordered_columns,
    )


def apply_king_ordering(matrix, max_iterations=10):
    if not matrix:
        return 0, [], []

    product_names = [str(i) for i in range(len(matrix))]
    machine_names = [str(j) for j in range(len(matrix[0]))]

    iterations, _, ordered_product_names, ordered_machine_names = methode_king(
        matrix,
        machine_names=machine_names,
        product_names=product_names,
        max_iterations=max_iterations,
    )

    row_order = [int(name) for name in ordered_product_names]
    col_order = [int(name) for name in ordered_machine_names]

    return iterations, row_order, col_order


def score_cells(ordered_matrix, blocks):
    exceptional = 0
    voids = 0
    inside_ones = 0
    inside_total = 0

    for block in blocks:
        for i in range(block["row_start"], block["row_end"] + 1):
            for j in range(block["column_start"], block["column_end"] + 1):
                inside_total += 1
                if ordered_matrix[i][j] == 1:
                    inside_ones += 1
                else:
                    voids += 1

    for i, row in enumerate(ordered_matrix):
        for j, val in enumerate(row):
            if val == 1:
                in_block = any(
                    block["row_start"] <= i <= block["row_end"]
                    and block["column_start"] <= j <= block["column_end"]
                    for block in blocks
                )
                if not in_block:
                    exceptional += 1

    efficiency = round((inside_ones / inside_total) * 100, 2) if inside_total else 0
    return exceptional, voids, efficiency


@transaction.atomic
def run_king_analysis(company):
    products, machines, matrix = build_product_machine_matrix(company)

    if not machines or not products:
        raise ValueError("At least one machine and one product required.")

    iterations, ordered_matrix, ordered_product_codes, ordered_machine_codes = methode_king(
        matrix,
        machine_names=[m.code for m in machines],
        product_names=[p.reference for p in products],
    )

    ordered_matrix = ordered_matrix.tolist()

    analysis = KingAnalysis.objects.create(
        company=company,
        iterations=iterations,
        machine_order=ordered_machine_codes,
        product_order=ordered_product_codes,
        initial_matrix=matrix,
        ordered_matrix=ordered_matrix,
        cell_blocks=[],
        exceptional_elements=0,
        voids=0,
        efficiency=0,
    )

    return analysis


def detecter_groupes(matrix, row_labels, col_labels):
    n_rows, n_cols = matrix.shape
    if n_rows == 0 or n_cols == 0:
        return [], []

    product_groups = []
    machine_groups = []

    visited_rows = set()
    visited_cols = set()

    for row_index in range(n_rows):
        if row_index in visited_rows:
            continue

        group_rows = [row_index]
        group_cols = [col_index for col_index in range(n_cols) if matrix[row_index][col_index] == 1]
        if not group_cols:
            continue

        changed = True
        while changed:
            changed = False
            for candidate_row in range(n_rows):
                if candidate_row in group_rows:
                    continue
                for col_index in group_cols:
                    if matrix[candidate_row][col_index] == 1:
                        group_rows.append(candidate_row)
                        for candidate_col in range(n_cols):
                            if matrix[candidate_row][candidate_col] == 1 and candidate_col not in group_cols:
                                group_cols.append(candidate_col)
                        changed = True
                        break

        new_rows = [index for index in group_rows if index not in visited_rows]
        new_cols = [index for index in group_cols if index not in visited_cols]

        if new_rows and new_cols:
            product_groups.append([row_labels[index] for index in sorted(new_rows)])
            machine_groups.append([col_labels[index] for index in sorted(new_cols)])
            visited_rows.update(new_rows)
            visited_cols.update(new_cols)

    return product_groups, machine_groups


def build_distance_rows(M):
    n, m = len(M), len(M[0]) if len(M) else 0
    dist = np.zeros((n, n))

    for i in range(n):
        for j in range(n):
            inter = sum(M[i][k] * M[j][k] for k in range(m))
            union = sum(max(M[i][k], M[j][k]) for k in range(m))
            dist[i][j] = 1 - (inter / union if union else 0)

    return dist


def build_distance_cols(M):
    n, m = len(M), len(M[0]) if len(M) else 0
    dist = np.zeros((m, m))

    for i in range(m):
        for j in range(m):
            inter = sum(M[k][i] * M[k][j] for k in range(n))
            union = sum(max(M[k][i], M[k][j]) for k in range(n))
            dist[i][j] = 1 - (inter / union if union else 0)

    return dist


def _average_linkage_clusters(dist, threshold=0.5):
    size = len(dist)
    if size == 0:
        return np.array([], dtype=int)

    clusters = [{index} for index in range(size)]

    def average_distance(cluster_a, cluster_b):
        total = 0.0
        count = 0
        for i in cluster_a:
            for j in cluster_b:
                total += float(dist[i][j])
                count += 1
        return total / count if count else float("inf")

    while len(clusters) > 1:
        best_pair = None
        best_distance = float("inf")

        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                current_distance = average_distance(clusters[i], clusters[j])
                if current_distance < best_distance:
                    best_distance = current_distance
                    best_pair = (i, j)

        if best_pair is None or best_distance > threshold:
            break

        i, j = best_pair
        merged = clusters[i] | clusters[j]
        clusters = [cluster for index, cluster in enumerate(clusters) if index not in {i, j}]
        clusters.append(merged)

    labels = np.zeros(size, dtype=int)
    ordered_clusters = sorted(clusters, key=lambda cluster: min(cluster))
    for cluster_id, cluster in enumerate(ordered_clusters, start=1):
        for index in cluster:
            labels[index] = cluster_id

    return labels


def cluster_rows(M, threshold=0.5):
    dist = build_distance_rows(M)
    return _average_linkage_clusters(dist, threshold=threshold)


def cluster_cols(M, threshold=0.5):
    dist = build_distance_cols(M)
    return _average_linkage_clusters(dist, threshold=threshold)


def build_cells(row_clusters, col_clusters, pieces, machines):
    cells = {}

    for i, cluster_id in enumerate(row_clusters):
        cells.setdefault(int(cluster_id), {"pieces": [], "machines": []})
        cells[int(cluster_id)]["pieces"].append(pieces[i])

    for j, cluster_id in enumerate(col_clusters):
        cells.setdefault(int(cluster_id), {"pieces": [], "machines": []})
        cells[int(cluster_id)]["machines"].append(machines[j])

    final_cells = []
    for cluster_id in sorted(cells):
        final_cells.append(
            {
                "id": cluster_id,
                "pieces": cells[cluster_id]["pieces"],
                "machines": cells[cluster_id]["machines"],
            }
        )

    return final_cells


def build_adjacent_one_blocks(ordered_matrix, ordered_product_codes, ordered_machine_codes):
    row_count = len(ordered_matrix)
    column_count = len(ordered_matrix[0]) if row_count else 0
    if row_count == 0 or column_count == 0:
        return []

    max_void_ratio = 0.5
    visited = set()
    components = []
    side_neighbors = [
        (-1, 0),
        (0, -1), (0, 1),
        (1, 0),
    ]

    for row_index in range(row_count):
        for column_index in range(column_count):
            if ordered_matrix[row_index][column_index] != 1 or (row_index, column_index) in visited:
                continue

            stack = [(row_index, column_index)]
            component = []
            visited.add((row_index, column_index))

            while stack:
                current_row, current_col = stack.pop()
                component.append((current_row, current_col))

                for delta_row, delta_col in side_neighbors:
                    next_row = current_row + delta_row
                    next_col = current_col + delta_col
                    if not (0 <= next_row < row_count and 0 <= next_col < column_count):
                        continue
                    if ordered_matrix[next_row][next_col] != 1:
                        continue
                    if (next_row, next_col) in visited:
                        continue

                    visited.add((next_row, next_col))
                    stack.append((next_row, next_col))

            components.append(
                {
                    "cells": component,
                    "attached": False,
                }
            )

    def split_bridge_cells(raw_components):
        processed_components = []
        residual_components = []

        def side_connected_subcomponents(cells):
            remaining = set(cells)
            subcomponents = []
            while remaining:
                start = remaining.pop()
                stack = [start]
                subcomponent = [start]
                while stack:
                    current_row, current_col = stack.pop()
                    for delta_row, delta_col in side_neighbors:
                        next_cell = (current_row + delta_row, current_col + delta_col)
                        if next_cell not in remaining:
                            continue
                        remaining.remove(next_cell)
                        stack.append(next_cell)
                        subcomponent.append(next_cell)
                subcomponents.append(subcomponent)
            return subcomponents

        for component in raw_components:
            pending = [component["cells"]]
            while pending:
                cells = pending.pop()
                bridge_candidates = []

                for candidate_cell in sorted(cells):
                    candidate_row, candidate_col = candidate_cell
                    if candidate_row > candidate_col:
                        continue

                    belongs_to_dense_square = False
                    for square_row in (candidate_row - 1, candidate_row):
                        for square_col in (candidate_col - 1, candidate_col):
                            if not (0 <= square_row < row_count - 1 and 0 <= square_col < column_count - 1):
                                continue
                            square_ones = sum(
                                1
                                for row_offset in (0, 1)
                                for col_offset in (0, 1)
                                if ordered_matrix[square_row + row_offset][square_col + col_offset] == 1
                            )
                            if square_ones == 4:
                                belongs_to_dense_square = True
                                break
                        if belongs_to_dense_square:
                            break
                    if belongs_to_dense_square:
                        continue

                    reduced_cells = [cell for cell in cells if cell != candidate_cell]
                    if len(reduced_cells) < 2:
                        continue

                    subcomponents = side_connected_subcomponents(reduced_cells)
                    if len(subcomponents) < 2:
                        continue
                    if not any(len(subcomponent) > 1 for subcomponent in subcomponents):
                        continue

                    side_neighbor_count = sum(
                        1
                        for delta_row, delta_col in side_neighbors
                        if (candidate_row + delta_row, candidate_col + delta_col) in cells
                    )
                    bridge_candidates.append((side_neighbor_count, candidate_cell, subcomponents))

                if not bridge_candidates:
                    processed_components.append({"cells": cells, "attached": False})
                    continue

                _, bridge_cell, bridge_subcomponents = min(bridge_candidates, key=lambda item: (item[0], item[1]))
                residual_components.append({"cells": [bridge_cell], "attached": False, "residual": True, "residual_kind": "bridge"})
                pending.extend(bridge_subcomponents)

        return processed_components + residual_components

    components = split_bridge_cells(components)

    def split_protruding_cells(raw_components):
        processed_components = []
        residual_components = []

        def zero_count_for_cells(cells):
            rows = [row for row, _ in cells]
            cols = [col for _, col in cells]
            return sum(
                1
                for row_index in range(min(rows), max(rows) + 1)
                for column_index in range(min(cols), max(cols) + 1)
                if ordered_matrix[row_index][column_index] == 0
            )

        def is_connected(cells):
            cell_set = set(cells)
            if not cell_set:
                return False
            start = next(iter(cell_set))
            visited_cells = {start}
            stack = [start]
            while stack:
                current_row, current_col = stack.pop()
                for delta_row, delta_col in side_neighbors:
                    next_cell = (current_row + delta_row, current_col + delta_col)
                    if next_cell in cell_set and next_cell not in visited_cells:
                        visited_cells.add(next_cell)
                        stack.append(next_cell)
            return len(visited_cells) == len(cell_set)

        for component in raw_components:
            current_cells = list(component["cells"])
            changed = True
            while changed and len(current_cells) > 1:
                changed = False
                current_zero_count = zero_count_for_cells(current_cells)
                candidates = []

                for candidate_cell in sorted(current_cells):
                    reduced_cells = [cell for cell in current_cells if cell != candidate_cell]
                    if len(reduced_cells) < 2:
                        continue

                    reduced_zero_count = zero_count_for_cells(reduced_cells)
                    improvement = current_zero_count - reduced_zero_count
                    if improvement <= 0:
                        continue

                    candidate_row, candidate_col = candidate_cell
                    rows = [row for row, _ in current_cells]
                    cols = [col for _, col in current_cells]
                    if len(set(rows)) == 1 or len(set(cols)) == 1:
                        continue
                    if candidate_row >= candidate_col:
                        continue
                    if candidate_col != max(cols):
                        continue

                    candidates.append((-improvement, candidate_row, -candidate_col, candidate_cell))

                if not candidates:
                    continue

                _, _, _, protruding_cell = min(candidates)
                current_cells = [cell for cell in current_cells if cell != protruding_cell]
                residual_components.append({"cells": [protruding_cell], "attached": False, "residual": True, "residual_kind": "protrusion"})
                changed = True

            processed_components.append({"cells": current_cells, "attached": component.get("attached", False)})

        return processed_components + residual_components

    components = split_protruding_cells(components)

    def component_bounds(component):
        rows = [row for row, _ in component["cells"]]
        cols = [col for _, col in component["cells"]]
        return min(rows), max(rows), min(cols), max(cols)

    def direction_priority(single_row, single_col, row_start, row_end, col_start, col_end):
        group_is_above = row_end < single_row
        group_is_below = row_start > single_row
        group_is_left = col_end < single_col
        group_is_right = col_start > single_col

        if group_is_right and group_is_above:
            return 0
        if group_is_left and group_is_below:
            return 1
        if group_is_right:
            return 2
        if group_is_above:
            return 3
        if group_is_left:
            return 4
        if group_is_below:
            return 5
        return 6

    def rectangle_zero_count(cells):
        rows = [row for row, _ in cells]
        cols = [col for _, col in cells]
        row_start, row_end = min(rows), max(rows)
        col_start, col_end = min(cols), max(cols)
        return sum(
            1
            for row_index in range(row_start, row_end + 1)
            for column_index in range(col_start, col_end + 1)
            if ordered_matrix[row_index][column_index] == 0
        )

    def rectangle_area(cells):
        rows = [row for row, _ in cells]
        cols = [col for _, col in cells]
        return (max(rows) - min(rows) + 1) * (max(cols) - min(cols) + 1)

    base_components = [component for component in components if len(component["cells"]) > 1]
    singleton_components = [component for component in components if len(component["cells"]) == 1 and not component.get("residual")]
    residual_components = [component for component in components if len(component["cells"]) == 1 and component.get("residual")]
    protected_residual_cells = {component["cells"][0] for component in residual_components}

    def rectangle_contains_protected_residual(cells):
        if not protected_residual_cells:
            return False
        rows = [row for row, _ in cells]
        cols = [col for _, col in cells]
        row_start, row_end = min(rows), max(rows)
        col_start, col_end = min(cols), max(cols)
        return any(
            row_start <= residual_row <= row_end and col_start <= residual_col <= col_end
            for residual_row, residual_col in protected_residual_cells
        )

    base_component_bounds = {
        id(group): component_bounds(group)
        for group in base_components
    }

    for singleton in singleton_components:
        single_row, single_col = singleton["cells"][0]
        candidate_group = None
        candidate_signature = None

        for group in base_components:
            row_start, row_end, col_start, col_end = base_component_bounds[id(group)]
            touches_group = (
                row_start - 1 <= single_row <= row_end + 1
                and col_start - 1 <= single_col <= col_end + 1
            )
            if not touches_group:
                continue

            current_zero_count = rectangle_zero_count(group["cells"])
            merged_zero_count = rectangle_zero_count(group["cells"] + singleton["cells"])
            added_zero_count = merged_zero_count - current_zero_count
            if added_zero_count > 1:
                continue
            priority = direction_priority(single_row, single_col, row_start, row_end, col_start, col_end)
            if added_zero_count > 0 and priority == 2:
                continue

            signature = (
                added_zero_count,
                max(row_start - single_row, single_row - row_end, 0),
                max(col_start - single_col, single_col - col_end, 0),
                priority,
                row_start,
                col_start,
            )
            if candidate_signature is None or signature < candidate_signature:
                candidate_group = group
                candidate_signature = signature

        if candidate_group is not None:
            candidate_group["cells"].extend(singleton["cells"])
            singleton["attached"] = True

    final_components = base_components + [component for component in singleton_components if not component["attached"]]

    diagonal_merged = True
    while diagonal_merged:
        diagonal_merged = False
        next_components = []
        skipped = set()

        def is_pure_diagonal_component(component):
            cells = sorted(component["cells"])
            if not cells:
                return False
            rows = [row for row, _ in cells]
            cols = [col for _, col in cells]
            return (
                len(set(rows)) == len(cells)
                and len(set(cols)) == len(cells)
                and max(rows) - min(rows) + 1 == len(cells)
                and max(cols) - min(cols) + 1 == len(cells)
            )

        for left_index, left_component in enumerate(final_components):
            if left_index in skipped:
                continue

            current_component = {
                "cells": list(left_component["cells"]),
                "attached": left_component.get("attached", False),
            }
            left_row_start, left_row_end, left_col_start, left_col_end = component_bounds(current_component)

            for right_index in range(left_index + 1, len(final_components)):
                if right_index in skipped:
                    continue

                right_component = final_components[right_index]
                right_row_start, right_row_end, right_col_start, right_col_end = component_bounds(right_component)
                is_next_diagonal = (
                    is_pure_diagonal_component(current_component)
                    and is_pure_diagonal_component(right_component)
                    and right_row_start == left_row_end + 1
                    and right_col_start == left_col_end + 1
                    and right_row_end == right_row_start
                    and right_col_end == right_col_start
                )
                if not is_next_diagonal:
                    continue

                current_component["cells"].extend(right_component["cells"])
                skipped.add(right_index)
                diagonal_merged = True
                left_row_start, left_row_end, left_col_start, left_col_end = component_bounds(current_component)

            next_components.append(current_component)

        final_components = next_components

    def component_extents(component):
        rows = [row for row, _ in component["cells"]]
        cols = [col for _, col in component["cells"]]
        return min(rows), max(rows), min(cols), max(cols)

    def merge_priority(component_a, component_b):
        a_row_start, a_row_end, a_col_start, a_col_end = component_extents(component_a)
        b_row_start, b_row_end, b_col_start, b_col_end = component_extents(component_b)
        a_center_row = (a_row_start + a_row_end) / 2
        a_center_col = (a_col_start + a_col_end) / 2
        b_center_row = (b_row_start + b_row_end) / 2
        b_center_col = (b_col_start + b_col_end) / 2

        b_is_right = b_center_col > a_center_col
        b_is_left = b_center_col < a_center_col
        b_is_above = b_center_row < a_center_row
        b_is_below = b_center_row > a_center_row

        if b_is_right and b_is_above:
            return 0
        if b_is_left and b_is_below:
            return 1
        if b_is_right:
            return 2
        if b_is_above:
            return 3
        if b_is_left:
            return 4
        if b_is_below:
            return 5
        return 6

    merged = True
    while merged:
        merged = False
        best_pair = None
        best_signature = None

        for left_index in range(len(final_components)):
            for right_index in range(left_index + 1, len(final_components)):
                left_component = final_components[left_index]
                right_component = final_components[right_index]

                if rectangle_contains_protected_residual(left_component["cells"] + right_component["cells"]):
                    continue
                merged_zero_count = rectangle_zero_count(left_component["cells"] + right_component["cells"])
                merged_area = rectangle_area(left_component["cells"] + right_component["cells"])
                void_ratio = merged_zero_count / merged_area if merged_area else 1
                if void_ratio > max_void_ratio:
                    continue
                signature = (void_ratio, merged_zero_count, merge_priority(left_component, right_component), left_index, right_index)

                if best_signature is None or signature < best_signature:
                    best_signature = signature
                    best_pair = (left_index, right_index)

        if best_pair is None:
            break

        left_index, right_index = best_pair
        merged_component = {
            "cells": list(final_components[left_index]["cells"]) + list(final_components[right_index]["cells"]),
            "attached": False,
        }
        final_components = [
            component
            for index, component in enumerate(final_components)
            if index not in {left_index, right_index}
        ] + [merged_component]
        merged = True

    post_split_components = split_protruding_cells(final_components)
    final_components = [component for component in post_split_components if not component.get("residual")]
    residual_components.extend([component for component in post_split_components if component.get("residual")])

    merged = True
    while merged:
        merged = False
        best_pair = None
        best_signature = None

        for left_index in range(len(final_components)):
            for right_index in range(left_index + 1, len(final_components)):
                left_component = final_components[left_index]
                right_component = final_components[right_index]
                if rectangle_contains_protected_residual(left_component["cells"] + right_component["cells"]):
                    continue
                merged_zero_count = rectangle_zero_count(left_component["cells"] + right_component["cells"])
                merged_area = rectangle_area(left_component["cells"] + right_component["cells"])
                void_ratio = merged_zero_count / merged_area if merged_area else 1
                if void_ratio > max_void_ratio:
                    continue
                signature = (void_ratio, merged_zero_count, merge_priority(left_component, right_component), left_index, right_index)
                if best_signature is None or signature < best_signature:
                    best_signature = signature
                    best_pair = (left_index, right_index)

        if best_pair is None:
            break

        left_index, right_index = best_pair
        final_components = [
            component
            for index, component in enumerate(final_components)
            if index not in {left_index, right_index}
        ] + [
            {
                "cells": list(final_components[left_index]["cells"]) + list(final_components[right_index]["cells"]),
                "attached": False,
            }
        ]
        merged = True

    post_split_components = split_protruding_cells(final_components)
    final_components = [component for component in post_split_components if not component.get("residual")]
    residual_components.extend([component for component in post_split_components if component.get("residual")])

    remaining_residual_components = list(residual_components)
    absorbed = True
    while absorbed:
        absorbed = False
        next_residual_components = []

        for residual_component in remaining_residual_components:
            residual_cell = residual_component["cells"][0]
            residual_row, residual_col = residual_cell
            adjacent_component = None

            for component in final_components:
                row_start, row_end, col_start, col_end = component_extents(component)
                if residual_component.get("residual_kind") in {"bridge", "protrusion"} and row_start == 0:
                    continue
                component_height = row_end - row_start + 1
                is_right_of_small_neighbor = residual_col > col_end and component_height <= 2 and residual_row >= row_start
                is_lower_side = residual_row > row_start and residual_col >= col_start
                is_inside_block_span = row_start <= residual_row <= row_end and col_start <= residual_col <= col_end
                if not (is_right_of_small_neighbor or is_lower_side or is_inside_block_span):
                    continue
                touches_neighbor = any(
                    max(abs(residual_row - cell_row), abs(residual_col - cell_col)) == 1
                    for cell_row, cell_col in component["cells"]
                )
                if touches_neighbor:
                    adjacent_component = component
                    break

            if adjacent_component is None:
                next_residual_components.append(residual_component)
                continue

            if residual_cell not in adjacent_component["cells"]:
                adjacent_component["cells"].append(residual_cell)
            absorbed = True

        remaining_residual_components = next_residual_components

    residual_components = remaining_residual_components

    final_components.extend(residual_components)
    seen_cells = set()
    deduplicated_components = []
    for component in final_components:
        unique_cells = []
        for cell in component["cells"]:
            if cell in seen_cells:
                continue
            seen_cells.add(cell)
            unique_cells.append(cell)
        if unique_cells:
            component["cells"] = unique_cells
            deduplicated_components.append(component)
    final_components = deduplicated_components

    final_components.sort(key=lambda component: (min(row for row, _ in component["cells"]), min(col for _, col in component["cells"])))
    merged_right_residuals = []
    consumed_residual_indexes = set()
    for index, component in enumerate(final_components):
        if component.get("residual") or len(component["cells"]) == 1:
            continue
        row_start, row_end, col_start, col_end = component_extents(component)
        if row_start == 0:
            continue
        for residual_index, residual_component in enumerate(final_components):
            is_residual_component = residual_component.get("residual") or len(residual_component["cells"]) == 1
            if residual_index in consumed_residual_indexes or not is_residual_component:
                continue
            residual_row, residual_col = residual_component["cells"][0]
            if row_start <= residual_row <= row_end and col_end < residual_col <= col_end + 2:
                component["cells"].extend(residual_component["cells"])
                consumed_residual_indexes.add(residual_index)

    for index, component in enumerate(final_components):
        if index not in consumed_residual_indexes:
            merged_right_residuals.append(component)
    final_components = merged_right_residuals
    final_components.sort(key=lambda component: (min(row for row, _ in component["cells"]), min(col for _, col in component["cells"])))

    blocks = []
    for index, component in enumerate(final_components, start=1):
        row_indices = sorted({row for row, _ in component["cells"]})
        column_indices = sorted({col for _, col in component["cells"]})
        row_start = min(row_indices)
        row_end = max(row_indices)
        column_start = min(column_indices)
        column_end = max(column_indices)

        blocks.append(
            {
                "row_start": row_start,
                "row_end": row_end,
                "column_start": column_start,
                "column_end": column_end,
                "cell_index": index,
                "products": [ordered_product_codes[row_index] for row_index in row_indices],
                "machines": [ordered_machine_codes[column_index] for column_index in column_indices],
                "residual": len(component["cells"]) == 1 or component.get("residual", False),
            }
        )

    return blocks


def build_cell_blocks_from_groups(product_groups, machine_groups, ordered_product_codes, ordered_machine_codes):
    product_positions = {code: index for index, code in enumerate(ordered_product_codes)}
    machine_positions = {code: index for index, code in enumerate(ordered_machine_codes)}
    blocks = []

    for index, (products, machines) in enumerate(zip(product_groups, machine_groups), start=1):
        if not products or not machines:
            continue

        product_indices = sorted(product_positions[product] for product in products if product in product_positions)
        machine_indices = sorted(machine_positions[machine] for machine in machines if machine in machine_positions)
        if not product_indices or not machine_indices:
            continue

        blocks.append(
            {
                "row_start": min(product_indices),
                "row_end": max(product_indices),
                "column_start": min(machine_indices),
                "column_end": max(machine_indices),
                "cell_index": index,
                "products": [ordered_product_codes[product_index] for product_index in product_indices],
                "machines": [ordered_machine_codes[machine_index] for machine_index in machine_indices],
            }
        )

    return blocks


@transaction.atomic
def execute_king_analysis(company):
    analysis = run_king_analysis(company)
    ordered_matrix = analysis.ordered_matrix
    ordered_machine_codes = analysis.machine_order
    ordered_product_codes = analysis.product_order

    blocks = build_adjacent_one_blocks(
        ordered_matrix,
        ordered_product_codes,
        ordered_machine_codes,
    )
    exceptional, voids, efficiency = score_cells(ordered_matrix, blocks)

    analysis.cell_blocks = blocks
    analysis.exceptional_elements = exceptional
    analysis.voids = voids
    analysis.efficiency = efficiency
    analysis.save(update_fields=["cell_blocks", "exceptional_elements", "voids", "efficiency", "updated_at"])

    machine_lookup = {machine.code: machine for machine in company.machines.all()}
    analysis.machine_assignments.all().delete()
    for machine in company.machines.all():
        machine.current_cell = None
        machine.save(update_fields=["current_cell", "updated_at"])

    assigned_machine_codes = set()
    for block in blocks:
        for machine_code in block["machines"]:
            if machine_code in assigned_machine_codes:
                continue
            machine = machine_lookup.get(machine_code)
            if machine is None:
                continue
            machine.current_cell = block["cell_index"]
            machine.save(update_fields=["current_cell", "updated_at"])
            assigned_machine_codes.add(machine_code)
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
    dataframe.attrs["original_columns"] = list(dataframe.columns)
    dataframe.columns = [
        str(column).strip().lower().replace(" ", "_").replace("/", "_").replace("\\", "_").replace(":", "_")
        for column in dataframe.columns
    ]
    return dataframe


def _read_dataframes(uploaded_file):
    content = uploaded_file.read()
    filename = uploaded_file.name.lower()

    if filename.endswith(".csv"):
        return {"csv": _normalize_columns(pd.read_csv(io.BytesIO(content), sep=None, engine="python", encoding="utf-8-sig"))}

    workbook = pd.read_excel(io.BytesIO(content), sheet_name=None)
    return {name.lower(): _normalize_columns(dataframe) for name, dataframe in workbook.items()}


def _read_raw_dataframes(uploaded_file):
    content = uploaded_file.read()
    filename = uploaded_file.name.lower()

    if filename.endswith(".csv"):
        return {"csv": pd.read_csv(io.BytesIO(content), sep=None, engine="python", encoding="utf-8-sig")}

    workbook = pd.read_excel(io.BytesIO(content), sheet_name=None)
    return {name.lower(): dataframe for name, dataframe in workbook.items()}


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


def _machine_from_code(company, code, machine_name=""):
    machine, _ = Machine.objects.get_or_create(
        company=company,
        code=str(code).strip(),
        defaults={"name": machine_name or str(code).strip()},
    )
    return machine


def _looks_like_binary(value):
    if pd.isna(value):
        return True
    text = str(value).strip()
    return text in {"", "0", "1", "0.0", "1.0"}


def _parse_binary_value(value):
    if pd.isna(value):
        return 0
    text = str(value).strip()
    if not text:
        return 0
    if text in {"1", "1.0"}:
        return 1
    if text in {"0", "0.0"}:
        return 0
    raise ValueError(f"Invalid matrix value {value!r}. Only 0 or 1 are allowed.")


def _is_matrix_dataframe(dataframe):
    if dataframe.empty or len(dataframe.columns) < 2:
        return False

    values_only = dataframe.iloc[:, 1:]
    if values_only.empty:
        return False
    return values_only.apply(lambda column: column.map(_looks_like_binary)).to_numpy().all()


def _slugify_matrix_label(value, fallback):
    if pd.isna(value):
        return fallback
    text = str(value).strip()
    if not text:
        return fallback
    return text


@transaction.atomic
def import_king_matrix_data(company, uploaded_file):
    dataframes = _read_raw_dataframes(uploaded_file)
    imported = {"machines": 0, "products": 0, "routes": 0, "flows": 0}
    matrix_dataframe = None

    for dataframe in dataframes.values():
        candidate = dataframe.dropna(how="all").copy()
        candidate = candidate.dropna(axis=1, how="all")
        if _is_matrix_dataframe(candidate):
            matrix_dataframe = candidate.copy()
            break

    if matrix_dataframe is None:
        raise ValueError(
            "King import expects only an incidence matrix: first column for products, remaining columns for machines, "
            "and cells filled only with 0/1."
        )

    KingAnalysis.objects.filter(company=company).delete()
    MaterialFlow.objects.filter(company=company).delete()
    Product.objects.filter(company=company).delete()
    Machine.objects.filter(company=company).delete()

    product_column = matrix_dataframe.columns[0]
    source_machine_columns = list(matrix_dataframe.columns[1:])
    source_machine_headers = list(matrix_dataframe.columns[1:])

    machine_codes = []
    used_machine_codes = set()
    for index, header in enumerate(source_machine_headers, start=1):
        candidate = _slugify_matrix_label(header, f"M{index}")
        if candidate in used_machine_codes:
            suffix = 2
            while f"{candidate}_{suffix}" in used_machine_codes:
                suffix += 1
            candidate = f"{candidate}_{suffix}"
        used_machine_codes.add(candidate)
        machine_codes.append(candidate)

    preview_machine_codes = list(machine_codes)
    preview_product_references = []
    preview_matrix = []

    machine_lookup = {}
    for machine_code in machine_codes:
        machine = Machine.objects.create(company=company, code=machine_code, name=machine_code)
        machine_lookup[machine_code] = machine
        imported["machines"] += 1

    used_product_references = set()
    for row_index, (_, row) in enumerate(matrix_dataframe.iterrows(), start=1):
        if pd.isna(row[product_column]) and all(_looks_like_binary(row[column]) for column in source_machine_columns):
            continue

        product_reference = _slugify_matrix_label(row[product_column], f"P{row_index}")
        if product_reference in used_product_references:
            suffix = 2
            while f"{product_reference}_{suffix}" in used_product_references:
                suffix += 1
            product_reference = f"{product_reference}_{suffix}"
        used_product_references.add(product_reference)
        product = Product.objects.create(company=company, reference=product_reference, name=product_reference)
        imported["products"] += 1

        preview_product_references.append(product_reference)
        preview_row = []
        operation_order = 1
        for source_column, machine_code in zip(source_machine_columns, machine_codes):
            value = _parse_binary_value(row[source_column])
            preview_row.append(value)
            if value != 1:
                continue

            OperationRoute.objects.create(
                product=product,
                machine=machine_lookup[machine_code],
                operation_order=operation_order,
                operation_name=f"Op {operation_order}",
            )
            imported["routes"] += 1
            operation_order += 1
        preview_matrix.append(preview_row)

    return {
        "imported": imported,
        "preview": {
            "machine_codes": preview_machine_codes,
            "product_references": preview_product_references,
            "matrix": preview_matrix,
        },
    }


@transaction.atomic
def import_company_data(company, uploaded_file):
    dataframes = _read_dataframes(uploaded_file)
    imported = {"machines": 0, "products": 0, "routes": 0, "flows": 0}

    for dataframe in dataframes.values():
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
        has_gamme_column = any(column in columns for column in ["gamme", "routing", "route"])
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
                        "batch_size": _parse_numeric(
                            row.get("batch_size", row.get("lot", row.get("circuits_lot", 1))),
                            default=1,
                            cast_type=int,
                        ),
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
