from django.contrib import admin

from .models import (
    Company,
    KingAnalysis,
    Machine,
    MachineCellAssignment,
    MaterialFlow,
    OperationRoute,
    Product,
)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at", "updated_at")
    search_fields = ("name",)


@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "company", "current_cell")
    list_filter = ("company",)
    search_fields = ("code", "name")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("reference", "name", "company", "batch_size", "annual_demand")
    list_filter = ("company",)
    search_fields = ("reference", "name")


@admin.register(OperationRoute)
class OperationRouteAdmin(admin.ModelAdmin):
    list_display = ("product", "operation_order", "machine", "duration_minutes")
    list_filter = ("product__company",)
    ordering = ("product", "operation_order")


@admin.register(MaterialFlow)
class MaterialFlowAdmin(admin.ModelAdmin):
    list_display = ("company", "from_machine", "to_machine", "product", "ul_value")
    list_filter = ("company",)


class MachineCellAssignmentInline(admin.TabularInline):
    model = MachineCellAssignment
    extra = 0


@admin.register(KingAnalysis)
class KingAnalysisAdmin(admin.ModelAdmin):
    list_display = ("company", "created_at", "iterations", "efficiency", "exceptional_elements", "voids")
    list_filter = ("company",)
    inlines = [MachineCellAssignmentInline]
