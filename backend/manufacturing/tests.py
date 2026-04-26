import io

import pandas as pd
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Company, Machine, MaterialFlow, OperationRoute, Product
from .services import (
    apply_king_ordering,
    build_adjacent_one_blocks,
    detecter_groupes,
    execute_king_analysis,
    king_algorithm,
    run_king_analysis,
)


class KingAlgorithmServiceTests(TestCase):
    def setUp(self):
        self.company = Company.objects.create(name="AVL Electronics")
        self.machine_a = Machine.objects.create(company=self.company, code="A", name="Alimentation")
        self.machine_b = Machine.objects.create(company=self.company, code="B", name="Bobinage")
        self.machine_c = Machine.objects.create(company=self.company, code="C", name="Controle")

        product_1 = Product.objects.create(company=self.company, reference="P1", name="Produit 1")
        product_2 = Product.objects.create(company=self.company, reference="P2", name="Produit 2")

        OperationRoute.objects.create(product=product_1, machine=self.machine_a, operation_order=1)
        OperationRoute.objects.create(product=product_1, machine=self.machine_b, operation_order=2)
        OperationRoute.objects.create(product=product_2, machine=self.machine_b, operation_order=1)
        OperationRoute.objects.create(product=product_2, machine=self.machine_c, operation_order=2)

    def test_run_king_analysis_persists_assignments(self):
        analysis = execute_king_analysis(self.company)

        self.assertEqual(analysis.company, self.company)
        self.assertTrue(analysis.machine_order)
        self.assertTrue(analysis.product_order)
        self.assertGreaterEqual(analysis.iterations, 1)
        self.assertEqual(analysis.machine_assignments.count(), 3)
        self.assertTrue(any(block["cell_index"] == 1 for block in analysis.cell_blocks))
        self.machine_a.refresh_from_db()
        self.assertIsNotNone(self.machine_a.current_cell)

    def test_apply_king_ordering_returns_valid_permutations(self):
        matrix = [
            [1, 0, 0, 0, 0, 0],
            [0, 1, 0, 1, 0, 1],
            [0, 1, 0, 1, 1, 0],
            [1, 0, 1, 0, 0, 0],
            [0, 1, 0, 0, 0, 1],
            [1, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 1, 1],
        ]

        iterations, row_order, col_order = apply_king_ordering(matrix)

        self.assertGreaterEqual(iterations, 1)
        self.assertEqual(sorted(row_order), list(range(len(matrix))))
        self.assertEqual(sorted(col_order), list(range(len(matrix[0]))))

    def test_apply_king_ordering_preserves_order_on_equal_decimal_values(self):
        matrix = [
            [1, 1, 0],
            [1, 1, 0],
            [0, 0, 1],
        ]

        iterations, row_order, col_order = apply_king_ordering(matrix)

        self.assertGreaterEqual(iterations, 1)
        self.assertEqual(sorted(row_order), [0, 1, 2])
        self.assertEqual(sorted(col_order), [0, 1, 2])

    def test_apply_king_ordering_matches_user_supplied_siemens_case(self):
        matrix = [
            [1, 1, 0, 1, 1, 1, 0, 1],
            [1, 0, 1, 1, 0, 0, 1, 1],
            [0, 1, 0, 0, 0, 1, 1, 0],
            [0, 0, 1, 0, 1, 0, 0, 0],
            [1, 1, 0, 1, 0, 1, 0, 0],
            [1, 0, 1, 0, 1, 0, 0, 1],
            [0, 1, 1, 0, 1, 0, 1, 0],
            [0, 0, 0, 1, 0, 1, 0, 1],
        ]

        iterations, row_order, col_order = apply_king_ordering(matrix)

        self.assertGreaterEqual(iterations, 1)
        self.assertEqual(sorted(row_order), list(range(8)))
        self.assertEqual(sorted(col_order), list(range(8)))

    def test_apply_king_ordering_matches_jackadit_reference_case(self):
        matrix = [
            [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
            [0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0],
            [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        ]

        iterations, row_order, col_order = apply_king_ordering(matrix)

        self.assertGreaterEqual(iterations, 1)
        self.assertEqual(row_order, [0, 5, 3, 4, 1, 2])
        self.assertEqual(col_order, [8, 11, 9, 0, 3, 10, 2, 4, 6, 1, 5, 7])

    def test_detecter_groupes_builds_diagonal_groups_from_reference_case(self):
        ordered_matrix = [
            [1, 1, 1, 0, 0, 0],
            [1, 1, 1, 0, 0, 0],
            [1, 1, 0, 0, 0, 0],
            [1, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0],
            [0, 0, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 1, 1],
            [0, 0, 0, 0, 1, 1],
            [0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 1],
        ]
        product_order = ["P2", "P8", "P5", "P7", "P3", "P4"]
        machine_order = ["14", "17", "3", "15", "6", "16", "5", "10", "12", "4", "11", "13"]

        product_groups, machine_groups = detecter_groupes(
            pd.DataFrame(ordered_matrix).to_numpy().T,
            product_order,
            machine_order,
        )

        self.assertEqual(product_groups, [["P2", "P8", "P5", "P7", "P3", "P4"]])
        self.assertEqual(
            machine_groups,
            [["14", "17", "3", "15", "6", "16", "5", "10", "12", "4", "11", "13"]],
        )

    def test_king_algorithm_matches_user_supplied_15x10_example(self):
        pieces = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12", "P13", "P14", "P15"]
        machines = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10"]
        matrix = [
            [1, 1, 0, 1, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 0, 0, 0, 1, 0, 0, 1],
            [1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 1, 1, 0, 1, 1, 1],
            [1, 1, 0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 1, 0, 0, 1, 1, 1],
            [1, 1, 0, 0, 0, 0, 1, 0, 0, 1],
            [0, 0, 1, 0, 1, 0, 0, 1, 1, 1],
            [0, 1, 0, 1, 0, 0, 1, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 1, 1, 0, 1, 1, 1],
            [1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0, 1, 1],
            [1, 1, 0, 1, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 0, 0, 1, 0, 0, 1],
        ]

        result = king_algorithm(matrix, pieces, machines)

        self.assertEqual(result["iterations"], 3)
        self.assertEqual(result["pieces"], ["P1", "P2", "P7", "P5", "P14", "P3", "P12", "P15", "P9", "P10", "P4", "P6", "P8", "P13", "P11"])
        self.assertEqual(result["machines"], ["M1", "M2", "M10", "M4", "M7", "M3", "M9", "M5", "M8", "M6"])

    def test_build_adjacent_one_blocks_creates_blocks_and_single_residue(self):
        ordered_matrix = [
            [1, 1, 0, 0],
            [1, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ]
        ordered_products = ["P1", "P2", "P3", "P4"]
        ordered_machines = ["M1", "M2", "M3", "M4"]

        blocks = build_adjacent_one_blocks(ordered_matrix, ordered_products, ordered_machines)

        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[0]["products"], ["P1", "P2"])
        self.assertEqual(blocks[0]["machines"], ["M1", "M2"])
        self.assertFalse(blocks[0]["residual"])
        self.assertEqual(blocks[1]["products"], ["P3", "P4"])
        self.assertEqual(blocks[1]["machines"], ["M3", "M4"])
        self.assertFalse(blocks[1]["residual"])

    def test_build_adjacent_one_blocks_attaches_corner_singleton_to_existing_submatrix_only(self):
        ordered_matrix = [
            [1, 1, 0, 0, 0],
            [1, 1, 0, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 0, 1],
        ]
        ordered_products = ["P1", "P2", "P3", "P4"]
        ordered_machines = ["M1", "M2", "M3", "M4", "M5"]

        blocks = build_adjacent_one_blocks(ordered_matrix, ordered_products, ordered_machines)

        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[0]["products"], ["P1", "P2", "P3"])
        self.assertEqual(blocks[0]["machines"], ["M1", "M2", "M3"])
        self.assertFalse(blocks[0]["residual"])
        self.assertEqual(blocks[1]["products"], ["P4"])
        self.assertEqual(blocks[1]["machines"], ["M5"])
        self.assertTrue(blocks[1]["residual"])

    def test_build_adjacent_one_blocks_prefers_right_before_up_for_equal_singleton_attachment_cost(self):
        ordered_matrix = [
            [0, 0, 0, 1, 1],
            [0, 0, 1, 1, 1],
            [1, 1, 0, 0, 0],
            [1, 1, 0, 0, 0],
        ]
        ordered_products = ["P1", "P2", "P3", "P4"]
        ordered_machines = ["M1", "M2", "M3", "M4", "M5"]

        blocks = build_adjacent_one_blocks(ordered_matrix, ordered_products, ordered_machines)

        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[0]["products"], ["P1", "P2"])
        self.assertEqual(blocks[0]["machines"], ["M3", "M4", "M5"])

    def test_build_adjacent_one_blocks_merges_two_groups_when_single_zero_bridges_them(self):
        ordered_matrix = [
            [1, 1, 1],
            [1, 0, 1],
            [1, 1, 1],
        ]
        ordered_products = ["P1", "P2", "P3"]
        ordered_machines = ["M1", "M2", "M3"]

        blocks = build_adjacent_one_blocks(ordered_matrix, ordered_products, ordered_machines)

        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["products"], ["P1", "P2", "P3"])
        self.assertEqual(blocks[0]["machines"], ["M1", "M2", "M3"])
        self.assertFalse(blocks[0]["residual"])

    def test_build_adjacent_one_blocks_prefers_side_merge_with_fewer_zeros(self):
        ordered_matrix = [
            [1, 1, 0, 1, 0, 0, 1],
            [1, 1, 0, 1, 0, 0, 1],
        ]
        ordered_products = ["P1", "P2"]
        ordered_machines = ["M1", "M2", "M3", "M4", "M5", "M6", "M7"]

        blocks = build_adjacent_one_blocks(ordered_matrix, ordered_products, ordered_machines)

        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["machines"], ["M1", "M2", "M4", "M7"])

    def test_build_adjacent_one_blocks_keeps_upper_right_and_lower_left_as_separate_low_zero_ilots(self):
        ordered_matrix = [
            [0, 0, 1, 1],
            [0, 0, 1, 1],
            [1, 1, 0, 0],
            [1, 1, 0, 0],
        ]
        ordered_products = ["P1", "P2", "P3", "P4"]
        ordered_machines = ["M1", "M2", "M3", "M4"]

        blocks = build_adjacent_one_blocks(ordered_matrix, ordered_products, ordered_machines)

        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["products"], ["P1", "P2", "P3", "P4"])
        self.assertEqual(blocks[0]["machines"], ["M1", "M2", "M3", "M4"])

    def test_build_adjacent_one_blocks_splits_bridge_one_as_residue_and_keeps_diagonal_block(self):
        ordered_matrix = [
            [1, 1, 0, 0],
            [1, 1, 1, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ]
        ordered_products = ["P1", "P2", "P3", "P4"]
        ordered_machines = ["M1", "M2", "M3", "M4"]

        blocks = build_adjacent_one_blocks(ordered_matrix, ordered_products, ordered_machines)

        self.assertEqual(len(blocks), 3)
        self.assertEqual(blocks[0]["products"], ["P1", "P2"])
        self.assertEqual(blocks[0]["machines"], ["M1", "M2"])
        self.assertFalse(blocks[0]["residual"])
        self.assertEqual(blocks[1]["products"], ["P2"])
        self.assertEqual(blocks[1]["machines"], ["M3"])
        self.assertTrue(blocks[1]["residual"])
        self.assertEqual(blocks[2]["products"], ["P3", "P4"])
        self.assertEqual(blocks[2]["machines"], ["M3", "M4"])
        self.assertFalse(blocks[2]["residual"])

    def test_build_adjacent_one_blocks_matches_classic_king_expected_cells_with_residue(self):
        ordered_matrix = [
            [1, 1, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 0, 0, 0],
            [1, 0, 1, 1, 0, 0, 0],
            [0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 1, 1],
        ]
        ordered_products = ["P1", "P5", "P3", "P7", "P2", "P6", "P4"]
        ordered_machines = ["M5", "M2", "M3", "M4", "M6", "M1", "M7"]

        blocks = build_adjacent_one_blocks(ordered_matrix, ordered_products, ordered_machines)

        self.assertEqual(len(blocks), 3)
        self.assertEqual(blocks[0]["products"], ["P1", "P5", "P3", "P7"])
        self.assertEqual(blocks[0]["machines"], ["M5", "M2", "M3"])
        self.assertFalse(blocks[0]["residual"])
        self.assertEqual(blocks[1]["products"], ["P3"])
        self.assertEqual(blocks[1]["machines"], ["M4"])
        self.assertTrue(blocks[1]["residual"])
        self.assertEqual(blocks[2]["products"], ["P2", "P6", "P4"])
        self.assertEqual(blocks[2]["machines"], ["M4", "M6", "M1", "M7"])
        self.assertFalse(blocks[2]["residual"])

    def test_build_adjacent_one_blocks_keeps_lower_left_side_cells_with_neighboring_ilot(self):
        ordered_matrix = [
            [0, 0, 0],
            [1, 1, 0],
            [1, 1, 0],
        ]
        ordered_products = ["P1", "P2", "P3"]
        ordered_machines = ["M1", "M2", "M3"]

        blocks = build_adjacent_one_blocks(ordered_matrix, ordered_products, ordered_machines)

        residual_blocks = [block for block in blocks if block["residual"]]
        self.assertEqual(residual_blocks, [])
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]["products"], ["P2", "P3"])
        self.assertEqual(blocks[0]["machines"], ["M1", "M2"])

    def test_build_adjacent_one_blocks_absorbs_bottom_right_side_cells_into_neighboring_ilot(self):
        ordered_matrix = [
            [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
            [1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        ]
        ordered_products = ["A", "D", "E", "F", "G", "C", "B", "H"]
        ordered_machines = ["F1", "S1", "P2", "T1", "T2", "F3", "P3", "T3", "S3", "P1", "F2", "S2"]

        blocks = build_adjacent_one_blocks(ordered_matrix, ordered_products, ordered_machines)

        residual_blocks = [block for block in blocks if block["residual"]]
        self.assertEqual(len(residual_blocks), 1)
        self.assertEqual(residual_blocks[0]["products"], ["E"])
        self.assertEqual(residual_blocks[0]["machines"], ["F3"])
        bottom_block = blocks[-1]
        self.assertFalse(bottom_block["residual"])
        self.assertEqual(bottom_block["products"], ["B", "H"])
        self.assertEqual(bottom_block["machines"], ["S3", "P1", "F2", "S2"])

    def test_execute_king_analysis_does_not_duplicate_machine_assignments_when_blocks_share_machine(self):
        company = Company.objects.create(name="Shared Machine Co")
        machine_a = Machine.objects.create(company=company, code="M1", name="M1")
        machine_b = Machine.objects.create(company=company, code="M2", name="M2")
        product_1 = Product.objects.create(company=company, reference="P1", name="P1")
        product_2 = Product.objects.create(company=company, reference="P2", name="P2")
        product_3 = Product.objects.create(company=company, reference="P3", name="P3")

        OperationRoute.objects.create(product=product_1, machine=machine_a, operation_order=1)
        OperationRoute.objects.create(product=product_2, machine=machine_a, operation_order=1)
        OperationRoute.objects.create(product=product_2, machine=machine_b, operation_order=2)
        OperationRoute.objects.create(product=product_3, machine=machine_b, operation_order=1)

        analysis = execute_king_analysis(company)

        assignment_machine_codes = list(
            analysis.machine_assignments.order_by("machine__code").values_list("machine__code", flat=True)
        )
        self.assertEqual(assignment_machine_codes, ["M1", "M2"])


class ManufacturingApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = Company.objects.create(name="Cell Factory")
        self.machine_a = Machine.objects.create(company=self.company, code="A", name="Cut")
        self.machine_b = Machine.objects.create(company=self.company, code="B", name="Drill")
        self.product = Product.objects.create(company=self.company, reference="PX-1", name="Panel")
        OperationRoute.objects.create(product=self.product, machine=self.machine_a, operation_order=1)
        OperationRoute.objects.create(product=self.product, machine=self.machine_b, operation_order=2)
        MaterialFlow.objects.create(
            company=self.company,
            product=self.product,
            from_machine=self.machine_a,
            to_machine=self.machine_b,
            ul_value=25,
        )

    def test_company_analytics_returns_latest_analysis(self):
        execute_king_analysis(self.company)
        response = self.client.get(f"/api/companies/{self.company.pk}/analytics/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["machines"], 2)
        self.assertIsNotNone(payload["latest_analysis"])
        self.assertEqual(payload["flows"][0]["ul_value"], 25.0)

    def test_import_endpoint_accepts_csv_gamme_file(self):
        csv_content = "\n".join(
            [
                "reference,name,batch_size,gamme",
                "PX-2,Bracket,20,A-B",
            ]
        )
        upload = SimpleUploadedFile("gammes.csv", csv_content.encode("utf-8"), content_type="text/csv")
        response = self.client.post(
            f"/api/companies/{self.company.pk}/import/",
            {"file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Product.objects.filter(company=self.company, reference="PX-2").exists())
        self.assertGreaterEqual(Machine.objects.filter(company=self.company).count(), 2)

    def test_import_king_endpoint_rejects_non_matrix_file(self):
        csv_content = "\n".join(
            [
                "reference,name,batch_size,gamme",
                "PX-3,Support,10,A-B",
            ]
        )
        upload = SimpleUploadedFile("king.csv", csv_content.encode("utf-8"), content_type="text/csv")
        response = self.client.post(
            f"/api/companies/{self.company.pk}/import-king/",
            {"file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("incidence matrix", response.json()["detail"])

    def test_import_king_endpoint_accepts_incidence_matrix_file(self):
        csv_content = "\n".join(
            [
                "Produit,E,F,G,D",
                "26-0031-00,1,1,1,1",
                "23-0029-00,1,1,1,0",
                "26-0022-00,1,0,0,1",
            ]
        )
        upload = SimpleUploadedFile("king_matrix.csv", csv_content.encode("utf-8"), content_type="text/csv")
        response = self.client.post(
            f"/api/companies/{self.company.pk}/import-king/",
            {"file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["detail"], "King import completed.")
        self.assertEqual(response.json()["preview"]["machine_codes"], ["E", "F", "G", "D"])
        self.assertEqual(response.json()["preview"]["product_references"], ["26-0031-00", "23-0029-00", "26-0022-00"])
        self.assertEqual(response.json()["preview"]["matrix"][0], [1, 1, 1, 1])
        self.assertEqual(Machine.objects.filter(company=self.company).count(), 4)
        self.assertEqual(Product.objects.filter(company=self.company).count(), 3)
        self.assertEqual(
            list(Machine.objects.filter(company=self.company).order_by("code").values_list("code", flat=True)),
            ["D", "E", "F", "G"],
        )
        self.assertEqual(
            list(Product.objects.filter(company=self.company).order_by("reference").values_list("reference", flat=True)),
            ["23-0029-00", "26-0022-00", "26-0031-00"],
        )
        self.assertEqual(Product.objects.get(company=self.company, reference="26-0031-00").routes.count(), 4)
        self.assertEqual(
            [route.machine.code for route in Product.objects.get(company=self.company, reference="23-0029-00").routes.order_by("operation_order")],
            ["E", "F", "G"],
        )

    def test_import_chainon_endpoint_accepts_csv_gamme_file(self):
        csv_content = "\n".join(
            [
                "reference,name,batch_size,gamme",
                "PX-4,Facade,8,A-B",
            ]
        )
        upload = SimpleUploadedFile("chainon.csv", csv_content.encode("utf-8"), content_type="text/csv")
        response = self.client.post(
            f"/api/companies/{self.company.pk}/import-chainon/",
            {"file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["detail"], "Chainon import completed.")
        self.assertTrue(Product.objects.filter(company=self.company, reference="PX-4").exists())

    def test_import_endpoint_accepts_excel_with_french_headers(self):
        payload = io.BytesIO()
        with pd.ExcelWriter(payload, engine="openpyxl") as writer:
            pd.DataFrame(
                [
                    {"poste": "M1", "fonction": "Decoupe", "description": "Poste de decoupe"},
                    {"poste": "M2", "fonction": "Percage", "description": "Poste de percage"},
                ]
            ).to_excel(writer, sheet_name="Machines", index=False)
            pd.DataFrame(
                [
                    {"ligne": "L1", "produit": "PX-9", "gamme": "M1-M2", "circuit": "", "lot": 12},
                ]
            ).to_excel(writer, sheet_name="Gammes", index=False)

        upload = SimpleUploadedFile(
            "manufacturing.xlsx",
            payload.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response = self.client.post(
            f"/api/companies/{self.company.pk}/import/",
            {"file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        product = Product.objects.get(company=self.company, reference="PX-9")
        self.assertEqual(product.batch_size, 12)
        self.assertEqual(product.routes.count(), 2)
        self.assertTrue(Machine.objects.filter(company=self.company, code="M1", name="Decoupe").exists())

    def test_import_endpoint_accepts_line_product_gamme_circuits_lot_format(self):
        payload = io.BytesIO()
        with pd.ExcelWriter(payload, engine="openpyxl") as writer:
            pd.DataFrame(
                [
                    {"poste": "A", "fonction": "Bobinage", "description": ""},
                    {"poste": "B", "fonction": "Soudure", "description": ""},
                    {"poste": "C", "fonction": "Controle", "description": ""},
                    {"poste": "D", "fonction": "Montage", "description": ""},
                    {"poste": "E", "fonction": "AQL", "description": ""},
                    {"poste": "F", "fonction": "Vernissage", "description": ""},
                    {"poste": "G", "fonction": "Nettoyage", "description": ""},
                ]
            ).to_excel(writer, sheet_name="Machines", index=False)
            pd.DataFrame(
                [
                    {"ligne": "AVL", "produit": "23-0029-00", "gamme": "B", "circuits/lot": 50},
                    {"ligne": "AVL", "produit": "26-0027-00", "gamme": "D-F", "circuits/lot": 16},
                    {"ligne": "AVL", "produit": "26-0028-00", "gamme": "C-D-E", "circuits/lot": 16},
                    {"ligne": "AVL", "produit": "26-0022-00", "gamme": "A-G", "circuits/lot": 25},
                ]
            ).to_excel(writer, sheet_name="Gammes", index=False)

        upload = SimpleUploadedFile(
            "manufacturing_real.xlsx",
            payload.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response = self.client.post(
            f"/api/companies/{self.company.pk}/import/",
            {"file": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Product.objects.get(company=self.company, reference="23-0029-00").batch_size, 50)
        self.assertEqual(
            [route.machine.code for route in Product.objects.get(company=self.company, reference="26-0027-00").routes.order_by("operation_order")],
            ["D", "F"],
        )
        self.assertEqual(
            [route.machine.code for route in Product.objects.get(company=self.company, reference="26-0022-00").routes.order_by("operation_order")],
            ["A", "G"],
        )

    def test_run_king_endpoint_creates_analysis(self):
        response = self.client.post(f"/api/companies/{self.company.pk}/run-king/")

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertIn("ordered_matrix", payload)
        self.assertEqual(len(payload["machine_assignments"]), 2)
