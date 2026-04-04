import os
import sys
from pathlib import Path

import django


BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django.setup()

from manufacturing.models import Company, Machine, MaterialFlow, OperationRoute, Product  # noqa: E402


company, _ = Company.objects.get_or_create(
    name="AVL Electronics Tunisie",
    defaults={"description": "Jeu de donnees de demonstration pour la methode King."},
)

machines_data = [
    ("A", "Alimentation"),
    ("B", "Bobinage"),
    ("C", "Cablage"),
    ("D", "Decoupe"),
    ("E", "Encapsulation"),
    ("F", "Finition"),
    ("G", "Controle qualite"),
    ("H", "Soudure"),
    ("I", "Inspection"),
]

machine_objs = {}
for code, name in machines_data:
    machine, _ = Machine.objects.get_or_create(company=company, code=code, defaults={"name": name})
    machine_objs[code] = machine

products_data = [
    ("23-0029-00", "Circuit AVL-1", 50, ["A", "D", "E", "F", "G"]),
    ("26-0027-00", "Circuit AVL-2", 16, ["A", "D", "E", "F", "G"]),
    ("26-0028-00", "Circuit AVL-3", 16, ["A", "D", "E", "F", "G"]),
    ("26-0022-00", "Circuit AVL-4", 25, ["A", "B", "C", "D", "E", "F", "G"]),
]

for reference, name, batch_size, gamme in products_data:
    product, _ = Product.objects.get_or_create(
        company=company,
        reference=reference,
        defaults={"name": name, "batch_size": batch_size},
    )
    for order, machine_code in enumerate(gamme, start=1):
        OperationRoute.objects.get_or_create(
            product=product,
            operation_order=order,
            defaults={
                "machine": machine_objs[machine_code],
                "operation_name": f"Operation {order}",
            },
        )

flows_data = [
    ("A", "D", 82),
    ("B", "C", 75),
    ("C", "D", 75),
    ("D", "E", 165),
    ("E", "F", 165),
    ("F", "G", 165),
]

for from_code, to_code, ul_value in flows_data:
    MaterialFlow.objects.get_or_create(
        company=company,
        from_machine=machine_objs[from_code],
        to_machine=machine_objs[to_code],
        defaults={"ul_value": ul_value},
    )

print("Demo data seeded.")
