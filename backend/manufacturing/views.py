from django.db.models import Sum
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Company, KingAnalysis, Machine, MaterialFlow, OperationRoute, Product
from .serializers import (
    CompanySerializer,
    KingAnalysisSerializer,
    MachineSerializer,
    MaterialFlowSerializer,
    OperationRouteSerializer,
    ProductSerializer,
    ProductWriteSerializer,
)
from .services import build_incidence_matrix, import_company_data, run_king_analysis


class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer

    @action(detail=True, methods=["get"])
    def analytics(self, request, pk=None):
        company = self.get_object()
        machines = company.machines.order_by("code")
        products = company.products.prefetch_related("routes__machine").order_by("reference")
        flows = company.flows.select_related("from_machine", "to_machine", "product")
        latest_analysis = company.king_analyses.prefetch_related("machine_assignments__machine").first()
        _, _, matrix = build_incidence_matrix(company)

        return Response(
            {
                "company": CompanySerializer(company).data,
                "summary": {
                    "machines": machines.count(),
                    "products": products.count(),
                    "gammes": OperationRoute.objects.filter(product__company=company).values("product").distinct().count(),
                    "flows": flows.count(),
                    "ul_total": flows.aggregate(total=Sum("ul_value")).get("total") or 0,
                },
                "incidence": {
                    "machine_codes": [machine.code for machine in machines],
                    "product_references": [product.reference for product in products],
                    "matrix": matrix,
                },
                "machines": MachineSerializer(machines, many=True).data,
                "products": ProductSerializer(products, many=True).data,
                "flows": MaterialFlowSerializer(flows, many=True).data,
                "latest_analysis": KingAnalysisSerializer(latest_analysis).data if latest_analysis else None,
            }
        )

    @action(detail=True, methods=["post"], url_path="import")
    def import_file(self, request, pk=None):
        company = self.get_object()
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"detail": "A CSV or Excel file is required."}, status=status.HTTP_400_BAD_REQUEST)

        imported = import_company_data(company, uploaded_file)
        return Response({"detail": "Import completed.", "imported": imported}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="run-king")
    def run_king(self, request, pk=None):
        company = self.get_object()
        try:
            analysis = run_king_analysis(company)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(KingAnalysisSerializer(analysis).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="king-analyses")
    def king_analyses(self, request, pk=None):
        company = self.get_object()
        analyses = company.king_analyses.prefetch_related("machine_assignments__machine")
        return Response(KingAnalysisSerializer(analyses, many=True).data)


class CompanyScopedViewSet(viewsets.ModelViewSet):
    company_lookup_url_kwarg = "company_pk"

    def get_company(self):
        return get_object_or_404(Company, pk=self.kwargs[self.company_lookup_url_kwarg])

    def get_queryset(self):
        raise NotImplementedError

    def perform_create(self, serializer):
        serializer.save(company=self.get_company())


class MachineViewSet(CompanyScopedViewSet):
    serializer_class = MachineSerializer

    def get_queryset(self):
        return Machine.objects.filter(company=self.get_company()).order_by("code")


class ProductViewSet(CompanyScopedViewSet):
    def get_queryset(self):
        return Product.objects.filter(company=self.get_company()).prefetch_related("routes__machine").order_by("reference")

    def get_serializer_class(self):
        if self.action in {"create", "update", "partial_update"}:
            return ProductWriteSerializer
        return ProductSerializer

    def _save_routes(self, product, routes_data):
        if routes_data is None:
            return
        product.routes.all().delete()
        for route in sorted(routes_data, key=lambda item: item.get("operation_order", 0)):
            machine_id = route.get("machine")
            machine_code = route.get("machine_code")
            if machine_id:
                machine = get_object_or_404(Machine, pk=machine_id, company=product.company)
            elif machine_code:
                machine, _ = Machine.objects.get_or_create(
                    company=product.company,
                    code=machine_code,
                    defaults={"name": machine_code},
                )
            else:
                raise ValueError("Each route must include machine or machine_code.")
            OperationRoute.objects.create(
                product=product,
                machine=machine,
                operation_order=route.get("operation_order"),
                operation_name=route.get("operation_name", ""),
                duration_minutes=route.get("duration_minutes", 0),
            )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        routes_data = serializer.validated_data.pop("routes", [])
        product = serializer.save(company=self.get_company())
        self._save_routes(product, routes_data)
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        routes_data = serializer.validated_data.pop("routes", None)
        product = serializer.save()
        if routes_data is not None:
            self._save_routes(product, routes_data)
        return Response(ProductSerializer(product).data)


class OperationRouteViewSet(CompanyScopedViewSet):
    serializer_class = OperationRouteSerializer

    def get_queryset(self):
        return OperationRoute.objects.filter(product__company=self.get_company()).select_related("machine", "product")


class MaterialFlowViewSet(CompanyScopedViewSet):
    serializer_class = MaterialFlowSerializer

    def get_queryset(self):
        return MaterialFlow.objects.filter(company=self.get_company()).select_related("from_machine", "to_machine", "product")


class KingAnalysisViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = KingAnalysisSerializer

    def get_queryset(self):
        company = get_object_or_404(Company, pk=self.kwargs["company_pk"])
        return KingAnalysis.objects.filter(company=company).prefetch_related("machine_assignments__machine")
