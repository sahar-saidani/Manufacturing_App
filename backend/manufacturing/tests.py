import io

import pandas as pd
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Company, Machine, MaterialFlow, OperationRoute, Product
from .services import run_king_analysis


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
        analysis = run_king_analysis(self.company)

        self.assertEqual(analysis.company, self.company)
        self.assertTrue(analysis.machine_order)
        self.assertTrue(analysis.product_order)
        self.assertGreaterEqual(analysis.iterations, 1)
        self.assertEqual(analysis.machine_assignments.count(), 3)
        self.assertTrue(any(block["cell_index"] == 1 for block in analysis.cell_blocks))
        self.machine_a.refresh_from_db()
        self.assertIsNotNone(self.machine_a.current_cell)


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
        run_king_analysis(self.company)
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

    def test_run_king_endpoint_creates_analysis(self):
        response = self.client.post(f"/api/companies/{self.company.pk}/run-king/")

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertIn("ordered_matrix", payload)
        self.assertEqual(len(payload["machine_assignments"]), 2)
