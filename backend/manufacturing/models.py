from django.core.validators import MinValueValidator
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Company(TimeStampedModel):
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Machine(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="machines")
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=50)
    description = models.CharField(max_length=255, blank=True)
    current_cell = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["company__name", "code"]
        unique_together = ("company", "code")

    def __str__(self):
        return f"{self.code} - {self.name}"


class Product(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="products")
    reference = models.CharField(max_length=100)
    name = models.CharField(max_length=200)
    batch_size = models.PositiveIntegerField(default=1)
    annual_demand = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["company__name", "reference"]
        unique_together = ("company", "reference")

    def __str__(self):
        return f"{self.reference} - {self.name}"


class OperationRoute(TimeStampedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="routes")
    machine = models.ForeignKey(Machine, on_delete=models.CASCADE, related_name="routes")
    operation_order = models.PositiveIntegerField()
    operation_name = models.CharField(max_length=200, blank=True)
    duration_minutes = models.FloatField(default=0, validators=[MinValueValidator(0)])

    class Meta:
        ordering = ["product__reference", "operation_order"]
        unique_together = ("product", "operation_order")

    def __str__(self):
        return f"{self.product.reference} - {self.operation_order} - {self.machine.code}"


class MaterialFlow(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="flows")
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="flows",
    )
    from_machine = models.ForeignKey(
        Machine,
        on_delete=models.CASCADE,
        related_name="outgoing_flows",
    )
    to_machine = models.ForeignKey(
        Machine,
        on_delete=models.CASCADE,
        related_name="incoming_flows",
    )
    ul_value = models.FloatField(default=0, validators=[MinValueValidator(0)])

    class Meta:
        ordering = ["company__name", "from_machine__code", "to_machine__code"]

    def __str__(self):
        return f"{self.from_machine.code} -> {self.to_machine.code} ({self.ul_value} UL)"


class KingAnalysis(TimeStampedModel):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="king_analyses")
    iterations = models.PositiveIntegerField(default=0)
    machine_order = models.JSONField(default=list)
    product_order = models.JSONField(default=list)
    initial_matrix = models.JSONField(default=list)
    ordered_matrix = models.JSONField(default=list)
    cell_blocks = models.JSONField(default=list)
    exceptional_elements = models.PositiveIntegerField(default=0)
    voids = models.PositiveIntegerField(default=0)
    efficiency = models.FloatField(default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"King analysis #{self.pk} - {self.company.name}"


class MachineCellAssignment(models.Model):
    analysis = models.ForeignKey(
        KingAnalysis,
        on_delete=models.CASCADE,
        related_name="machine_assignments",
    )
    machine = models.ForeignKey(
        Machine,
        on_delete=models.CASCADE,
        related_name="cell_assignments",
    )
    cell_index = models.PositiveIntegerField()
    block_row_start = models.PositiveIntegerField()
    block_row_end = models.PositiveIntegerField()
    block_column_start = models.PositiveIntegerField()
    block_column_end = models.PositiveIntegerField()

    class Meta:
        ordering = ["cell_index", "machine__code"]
        unique_together = ("analysis", "machine")

    def __str__(self):
        return f"{self.machine.code} -> Cell {self.cell_index}"
