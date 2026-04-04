from rest_framework import serializers

from .models import (
    Company,
    KingAnalysis,
    Machine,
    MachineCellAssignment,
    MaterialFlow,
    OperationRoute,
    Product,
)


class CompanySerializer(serializers.ModelSerializer):
    machine_count = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "description",
            "created_at",
            "updated_at",
            "machine_count",
            "product_count",
        ]

    def get_machine_count(self, obj):
        return obj.machines.count()

    def get_product_count(self, obj):
        return obj.products.count()


class MachineSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = Machine
        fields = [
            "id",
            "company",
            "company_name",
            "name",
            "code",
            "description",
            "current_cell",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"company": {"read_only": True}}


class OperationRouteSerializer(serializers.ModelSerializer):
    machine_code = serializers.CharField(source="machine.code", read_only=True)
    machine_name = serializers.CharField(source="machine.name", read_only=True)

    class Meta:
        model = OperationRoute
        fields = [
            "id",
            "product",
            "machine",
            "machine_code",
            "machine_name",
            "operation_order",
            "operation_name",
            "duration_minutes",
            "created_at",
            "updated_at",
        ]


class ProductSerializer(serializers.ModelSerializer):
    routes = OperationRouteSerializer(many=True, read_only=True)
    gamme = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "company",
            "reference",
            "name",
            "batch_size",
            "annual_demand",
            "gamme",
            "routes",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"company": {"read_only": True}}

    def get_gamme(self, obj):
        return [route.machine.code for route in obj.routes.all().order_by("operation_order")]


class MaterialFlowSerializer(serializers.ModelSerializer):
    from_machine_code = serializers.CharField(source="from_machine.code", read_only=True)
    to_machine_code = serializers.CharField(source="to_machine.code", read_only=True)
    product_reference = serializers.CharField(source="product.reference", read_only=True)

    class Meta:
        model = MaterialFlow
        fields = [
            "id",
            "company",
            "product",
            "product_reference",
            "from_machine",
            "from_machine_code",
            "to_machine",
            "to_machine_code",
            "ul_value",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"company": {"read_only": True}}


class MachineCellAssignmentSerializer(serializers.ModelSerializer):
    machine_code = serializers.CharField(source="machine.code", read_only=True)
    machine_name = serializers.CharField(source="machine.name", read_only=True)

    class Meta:
        model = MachineCellAssignment
        fields = [
            "id",
            "analysis",
            "machine",
            "machine_code",
            "machine_name",
            "cell_index",
            "block_row_start",
            "block_row_end",
            "block_column_start",
            "block_column_end",
        ]


class KingAnalysisSerializer(serializers.ModelSerializer):
    machine_assignments = MachineCellAssignmentSerializer(many=True, read_only=True)

    class Meta:
        model = KingAnalysis
        fields = [
            "id",
            "company",
            "iterations",
            "machine_order",
            "product_order",
            "initial_matrix",
            "ordered_matrix",
            "cell_blocks",
            "exceptional_elements",
            "voids",
            "efficiency",
            "machine_assignments",
            "created_at",
            "updated_at",
        ]


class ProductWriteSerializer(serializers.ModelSerializer):
    routes = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = Product
        fields = [
            "id",
            "company",
            "reference",
            "name",
            "batch_size",
            "annual_demand",
            "routes",
        ]
        extra_kwargs = {"company": {"read_only": True}}

    def validate_routes(self, value):
        orders = [item.get("operation_order") for item in value if item.get("operation_order") is not None]
        if len(orders) != len(set(orders)):
            raise serializers.ValidationError("operation_order must be unique within a product gamme.")
        return value
