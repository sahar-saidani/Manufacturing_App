# Generated manually for the manufacturing cell formation domain.

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Company",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=200, unique=True)),
                ("description", models.TextField(blank=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="KingAnalysis",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("iterations", models.PositiveIntegerField(default=0)),
                ("machine_order", models.JSONField(default=list)),
                ("product_order", models.JSONField(default=list)),
                ("initial_matrix", models.JSONField(default=list)),
                ("ordered_matrix", models.JSONField(default=list)),
                ("cell_blocks", models.JSONField(default=list)),
                ("exceptional_elements", models.PositiveIntegerField(default=0)),
                ("voids", models.PositiveIntegerField(default=0)),
                ("efficiency", models.FloatField(default=0)),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="king_analyses",
                        to="manufacturing.company",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Machine",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=120)),
                ("code", models.CharField(max_length=50)),
                ("description", models.CharField(blank=True, max_length=255)),
                ("current_cell", models.PositiveIntegerField(blank=True, null=True)),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="machines",
                        to="manufacturing.company",
                    ),
                ),
            ],
            options={"ordering": ["company__name", "code"], "unique_together": {("company", "code")}},
        ),
        migrations.CreateModel(
            name="Product",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("reference", models.CharField(max_length=100)),
                ("name", models.CharField(max_length=200)),
                ("batch_size", models.PositiveIntegerField(default=1)),
                ("annual_demand", models.PositiveIntegerField(default=0)),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="products",
                        to="manufacturing.company",
                    ),
                ),
            ],
            options={"ordering": ["company__name", "reference"], "unique_together": {("company", "reference")}},
        ),
        migrations.CreateModel(
            name="MachineCellAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("cell_index", models.PositiveIntegerField()),
                ("block_row_start", models.PositiveIntegerField()),
                ("block_row_end", models.PositiveIntegerField()),
                ("block_column_start", models.PositiveIntegerField()),
                ("block_column_end", models.PositiveIntegerField()),
                (
                    "analysis",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="machine_assignments",
                        to="manufacturing.kinganalysis",
                    ),
                ),
                (
                    "machine",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cell_assignments",
                        to="manufacturing.machine",
                    ),
                ),
            ],
            options={"ordering": ["cell_index", "machine__code"], "unique_together": {("analysis", "machine")}},
        ),
        migrations.CreateModel(
            name="OperationRoute",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("operation_order", models.PositiveIntegerField()),
                ("operation_name", models.CharField(blank=True, max_length=200)),
                (
                    "duration_minutes",
                    models.FloatField(
                        default=0,
                        validators=[django.core.validators.MinValueValidator(0)],
                    ),
                ),
                (
                    "machine",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="routes",
                        to="manufacturing.machine",
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="routes",
                        to="manufacturing.product",
                    ),
                ),
            ],
            options={"ordering": ["product__reference", "operation_order"], "unique_together": {("product", "operation_order")}},
        ),
        migrations.CreateModel(
            name="MaterialFlow",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "ul_value",
                    models.FloatField(
                        default=0,
                        validators=[django.core.validators.MinValueValidator(0)],
                    ),
                ),
                (
                    "company",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="flows",
                        to="manufacturing.company",
                    ),
                ),
                (
                    "from_machine",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="outgoing_flows",
                        to="manufacturing.machine",
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="flows",
                        to="manufacturing.product",
                    ),
                ),
                (
                    "to_machine",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="incoming_flows",
                        to="manufacturing.machine",
                    ),
                ),
            ],
            options={"ordering": ["company__name", "from_machine__code", "to_machine__code"]},
        ),
    ]
