from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CompanyViewSet,
    KingAnalysisViewSet,
    MachineViewSet,
    MaterialFlowViewSet,
    OperationRouteViewSet,
    ProductViewSet,
)

router = DefaultRouter()
router.register("companies", CompanyViewSet, basename="company")

company_resource_patterns = [
    path("companies/<int:company_pk>/machines/", MachineViewSet.as_view({"get": "list", "post": "create"})),
    path(
        "companies/<int:company_pk>/machines/<int:pk>/",
        MachineViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
    ),
    path("companies/<int:company_pk>/products/", ProductViewSet.as_view({"get": "list", "post": "create"})),
    path(
        "companies/<int:company_pk>/products/<int:pk>/",
        ProductViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
    ),
    path("companies/<int:company_pk>/gammes/", OperationRouteViewSet.as_view({"get": "list", "post": "create"})),
    path(
        "companies/<int:company_pk>/gammes/<int:pk>/",
        OperationRouteViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
    ),
    path("companies/<int:company_pk>/flows/", MaterialFlowViewSet.as_view({"get": "list", "post": "create"})),
    path(
        "companies/<int:company_pk>/flows/<int:pk>/",
        MaterialFlowViewSet.as_view(
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
        ),
    ),
    path(
        "companies/<int:company_pk>/king-analyses/",
        KingAnalysisViewSet.as_view({"get": "list"}),
    ),
    path(
        "companies/<int:company_pk>/king-analyses/<int:pk>/",
        KingAnalysisViewSet.as_view({"get": "retrieve"}),
    ),
]

urlpatterns = [
    path("", include(router.urls)),
    *company_resource_patterns,
]
