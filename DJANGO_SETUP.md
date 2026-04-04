# Configuration Django - Guide de Démarrage Rapide

## Installation Backend Django

### 1. Créer un Projet Django

```bash
# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Installer les dépendances
pip install django djangorestframework django-cors-headers psycopg2-binary pandas openpyxl

# Créer le projet
django-admin startproject manufacturing_backend
cd manufacturing_backend
python manage.py startapp api
```

### 2. Configuration settings.py

```python
# manufacturing_backend/settings.py

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Ajouter en premier
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",  # Alternative port
]

CORS_ALLOW_CREDENTIALS = True

# Database PostgreSQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'manufacturing_db',
        'USER': 'postgres',
        'PASSWORD': 'votre_mot_de_passe',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100
}
```

### 3. Modèles (api/models.py)

```python
from django.db import models

class Machine(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    cell_id = models.IntegerField(null=True, blank=True)
    load_hours = models.FloatField(default=0)
    utilization_rate = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

class Product(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    volume = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

class OperationRoute(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='routes')
    machine = models.ForeignKey(Machine, on_delete=models.CASCADE, related_name='routes')
    sequence_order = models.IntegerField()
    operation_time = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['product', 'sequence_order']
        unique_together = ['product', 'sequence_order']

    def __str__(self):
        return f"{self.product.code} - {self.machine.code} (Seq {self.sequence_order})"

class MaterialFlow(models.Model):
    from_machine = models.ForeignKey(Machine, related_name='flows_from', on_delete=models.CASCADE)
    to_machine = models.ForeignKey(Machine, related_name='flows_to', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    flow_volume = models.IntegerField()

    def __str__(self):
        return f"{self.from_machine.code} -> {self.to_machine.code} ({self.flow_volume} UL)"

class Cell(models.Model):
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=200)
    machine_ids = models.JSONField(default=list)
    color = models.CharField(max_length=7, default='#3b82f6')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} - {self.name}"

class KingAlgorithmResult(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    original_matrix = models.JSONField()
    reordered_matrix = models.JSONField()
    original_machine_order = models.JSONField()
    original_product_order = models.JSONField()
    reordered_machine_order = models.JSONField()
    reordered_product_order = models.JSONField()
    cells = models.JSONField()
    cell_blocks = models.JSONField()
    inter_cell_flows = models.IntegerField()
    intra_cell_flows = models.IntegerField()
    efficiency_score = models.FloatField()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"King Result {self.id} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"
```

### 4. Serializers (api/serializers.py)

```python
from rest_framework import serializers
from .models import Machine, Product, OperationRoute, MaterialFlow, Cell, KingAlgorithmResult

class MachineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Machine
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'

class OperationRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = OperationRoute
        fields = '__all__'

class MaterialFlowSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialFlow
        fields = '__all__'

class CellSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cell
        fields = '__all__'

class KingAlgorithmResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = KingAlgorithmResult
        fields = '__all__'
```

### 5. Views (api/views.py)

```python
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from django.http import JsonResponse
import pandas as pd
from .models import Machine, Product, OperationRoute, MaterialFlow, Cell, KingAlgorithmResult
from .serializers import *

class MachineViewSet(viewsets.ModelViewSet):
    queryset = Machine.objects.all()
    serializer_class = MachineSerializer

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

class OperationRouteViewSet(viewsets.ModelViewSet):
    queryset = OperationRoute.objects.all()
    serializer_class = OperationRouteSerializer

class MaterialFlowViewSet(viewsets.ModelViewSet):
    queryset = MaterialFlow.objects.all()
    serializer_class = MaterialFlowSerializer

class CellViewSet(viewsets.ModelViewSet):
    queryset = Cell.objects.all()
    serializer_class = CellSerializer

class KingAlgorithmResultViewSet(viewsets.ModelViewSet):
    queryset = KingAlgorithmResult.objects.all()
    serializer_class = KingAlgorithmResultSerializer

    @action(detail=False, methods=['post'])
    def run(self, request):
        # Implémentez l'algorithme King ici
        # ou laissez le frontend le gérer
        return Response({
            'message': 'Algorithme King exécuté',
            'id': 1
        })

    @action(detail=False, methods=['get'])
    def history(self, request):
        results = self.queryset.all()[:10]
        serializer = self.get_serializer(results, many=True)
        return Response(serializer.data)

@api_view(['GET'])
def health_check(request):
    return JsonResponse({'status': 'ok'})

@api_view(['POST'])
def import_data(request):
    file = request.FILES.get('file')
    
    if not file:
        return Response({'error': 'No file provided'}, status=400)
    
    try:
        if file.name.endswith('.xlsx') or file.name.endswith('.xls'):
            # Excel import
            machines_df = pd.read_excel(file, sheet_name='Machines')
            products_df = pd.read_excel(file, sheet_name='Produits')
            routes_df = pd.read_excel(file, sheet_name='Gammes')
            
            # Import machines
            for _, row in machines_df.iterrows():
                Machine.objects.get_or_create(
                    code=row['Code'],
                    defaults={
                        'name': row['Nom'],
                        'description': row.get('Description', '')
                    }
                )
            
            # Import products
            for _, row in products_df.iterrows():
                Product.objects.get_or_create(
                    code=row['Code'],
                    defaults={
                        'name': row['Nom'],
                        'volume': row['Volume'],
                        'description': row.get('Description', '')
                    }
                )
            
            # Import routes
            for _, row in routes_df.iterrows():
                product = Product.objects.get(code=row['Code Produit'])
                machine = Machine.objects.get(code=row['Code Machine'])
                OperationRoute.objects.get_or_create(
                    product=product,
                    machine=machine,
                    sequence_order=row['Ordre Séquence'],
                    defaults={
                        'operation_time': row.get('Temps Opération', 0)
                    }
                )
            
            return Response({
                'success': True,
                'message': f'Fichier {file.name} importé avec succès'
            })
        
        else:
            return Response({'error': 'Format non supporté'}, status=400)
            
    except Exception as e:
        return Response({'error': str(e)}, status=500)
```

### 6. URLs (api/urls.py)

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r'machines', MachineViewSet)
router.register(r'products', ProductViewSet)
router.register(r'operation-routes', OperationRouteViewSet)
router.register(r'material-flows', MaterialFlowViewSet)
router.register(r'cells', CellViewSet)
router.register(r'king-algorithm', KingAlgorithmResultViewSet, basename='king-algorithm')

urlpatterns = [
    path('', include(router.urls)),
    path('health/', health_check, name='health'),
    path('import/', import_data, name='import'),
]
```

### 7. URLs principales (manufacturing_backend/urls.py)

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
```

### 8. Migrations et Lancement

```bash
# Créer la base de données PostgreSQL
createdb manufacturing_db

# Faire les migrations
python manage.py makemigrations
python manage.py migrate

# Créer un superuser
python manage.py createsuperuser

# Lancer le serveur
python manage.py runserver
```

### 9. Admin (api/admin.py)

```python
from django.contrib import admin
from .models import Machine, Product, OperationRoute, MaterialFlow, Cell, KingAlgorithmResult

@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'cell_id', 'load_hours', 'utilization_rate']
    search_fields = ['code', 'name']

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'volume']
    search_fields = ['code', 'name']

@admin.register(OperationRoute)
class OperationRouteAdmin(admin.ModelAdmin):
    list_display = ['product', 'machine', 'sequence_order', 'operation_time']
    list_filter = ['product', 'machine']

@admin.register(MaterialFlow)
class MaterialFlowAdmin(admin.ModelAdmin):
    list_display = ['from_machine', 'to_machine', 'product', 'flow_volume']

@admin.register(Cell)
class CellAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'color', 'created_at']

@admin.register(KingAlgorithmResult)
class KingAlgorithmResultAdmin(admin.ModelAdmin):
    list_display = ['id', 'created_at', 'efficiency_score', 'inter_cell_flows', 'intra_cell_flows']
    list_filter = ['created_at']
```

## Test de l'API

Une fois le serveur Django lancé, testez avec :

```bash
# Health check
curl http://localhost:8000/api/health/

# Liste des machines
curl http://localhost:8000/api/machines/

# Créer une machine
curl -X POST http://localhost:8000/api/machines/ \
  -H "Content-Type: application/json" \
  -d '{"code": "M1", "name": "Tour CN 1", "description": "Tour à commande numérique"}'
```

## Prochaines Étapes

1. Implémenter l'algorithme King côté serveur (optionnel, déjà fait en frontend)
2. Ajouter l'authentification si nécessaire
3. Optimiser les requêtes avec select_related et prefetch_related
4. Ajouter des tests unitaires
5. Configurer un déploiement (Heroku, AWS, etc.)

---

L'API sera maintenant accessible et l'application React basculera automatiquement du mode démo au mode live !
