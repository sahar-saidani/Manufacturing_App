# Tests Django - Exemples

## Tests Unitaires

Créez `api/tests.py` :

```python
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Machine, Product, OperationRoute

class MachineModelTest(TestCase):
    def setUp(self):
        self.machine = Machine.objects.create(
            code='M1',
            name='Tour CN 1',
            description='Tour à commande numérique',
            load_hours=145,
            utilization_rate=0.72
        )

    def test_machine_creation(self):
        """Test la création d'une machine"""
        self.assertEqual(self.machine.code, 'M1')
        self.assertEqual(self.machine.name, 'Tour CN 1')
        self.assertIsNotNone(self.machine.created_at)

    def test_machine_str(self):
        """Test la représentation string"""
        self.assertEqual(str(self.machine), 'M1 - Tour CN 1')


class ProductModelTest(TestCase):
    def setUp(self):
        self.product = Product.objects.create(
            code='P1',
            name='Axe moteur A100',
            volume=500
        )

    def test_product_creation(self):
        """Test la création d'un produit"""
        self.assertEqual(self.product.code, 'P1')
        self.assertEqual(self.product.volume, 500)


class OperationRouteModelTest(TestCase):
    def setUp(self):
        self.machine = Machine.objects.create(
            code='M1',
            name='Tour CN 1'
        )
        self.product = Product.objects.create(
            code='P1',
            name='Axe moteur',
            volume=500
        )
        self.route = OperationRoute.objects.create(
            product=self.product,
            machine=self.machine,
            sequence_order=1,
            operation_time=0.5
        )

    def test_route_creation(self):
        """Test la création d'une route"""
        self.assertEqual(self.route.sequence_order, 1)
        self.assertEqual(self.route.operation_time, 0.5)

    def test_route_ordering(self):
        """Test l'ordre des routes"""
        route2 = OperationRoute.objects.create(
            product=self.product,
            machine=self.machine,
            sequence_order=2,
            operation_time=0.3
        )
        routes = OperationRoute.objects.filter(product=self.product)
        self.assertEqual(routes[0].sequence_order, 1)
        self.assertEqual(routes[1].sequence_order, 2)


class MachineAPITest(APITestCase):
    def setUp(self):
        self.machine_data = {
            'code': 'M1',
            'name': 'Tour CN 1',
            'description': 'Tour à commande numérique',
            'load_hours': 145,
            'utilization_rate': 0.72
        }

    def test_create_machine(self):
        """Test création d'une machine via API"""
        response = self.client.post('/api/machines/', self.machine_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Machine.objects.count(), 1)
        self.assertEqual(Machine.objects.get().code, 'M1')

    def test_list_machines(self):
        """Test liste des machines via API"""
        Machine.objects.create(**self.machine_data)
        response = self.client.get('/api/machines/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_get_machine(self):
        """Test récupération d'une machine via API"""
        machine = Machine.objects.create(**self.machine_data)
        response = self.client.get(f'/api/machines/{machine.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['code'], 'M1')

    def test_update_machine(self):
        """Test mise à jour d'une machine via API"""
        machine = Machine.objects.create(**self.machine_data)
        updated_data = {**self.machine_data, 'load_hours': 200}
        response = self.client.put(f'/api/machines/{machine.id}/', updated_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        machine.refresh_from_db()
        self.assertEqual(machine.load_hours, 200)

    def test_delete_machine(self):
        """Test suppression d'une machine via API"""
        machine = Machine.objects.create(**self.machine_data)
        response = self.client.delete(f'/api/machines/{machine.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Machine.objects.count(), 0)


class ProductAPITest(APITestCase):
    def setUp(self):
        self.product_data = {
            'code': 'P1',
            'name': 'Axe moteur A100',
            'volume': 500,
            'description': 'Axe pour moteur série A'
        }

    def test_create_product(self):
        """Test création d'un produit via API"""
        response = self.client.post('/api/products/', self.product_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Product.objects.count(), 1)

    def test_list_products(self):
        """Test liste des produits via API"""
        Product.objects.create(**self.product_data)
        response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


class HealthCheckTest(APITestCase):
    def test_health_check(self):
        """Test du health check endpoint"""
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ok')


class ImportDataTest(APITestCase):
    def test_import_excel_no_file(self):
        """Test import sans fichier"""
        response = self.client.post('/api/import/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # Note: Pour tester l'import de fichiers, utilisez SimpleUploadedFile
    # from django.core.files.uploadedfile import SimpleUploadedFile


class KingAlgorithmTest(TestCase):
    def setUp(self):
        # Créer des machines
        self.m1 = Machine.objects.create(code='M1', name='Machine 1')
        self.m2 = Machine.objects.create(code='M2', name='Machine 2')
        
        # Créer des produits
        self.p1 = Product.objects.create(code='P1', name='Product 1', volume=100)
        self.p2 = Product.objects.create(code='P2', name='Product 2', volume=150)
        
        # Créer des routes
        OperationRoute.objects.create(product=self.p1, machine=self.m1, sequence_order=1)
        OperationRoute.objects.create(product=self.p1, machine=self.m2, sequence_order=2)
        OperationRoute.objects.create(product=self.p2, machine=self.m1, sequence_order=1)

    def test_king_algorithm_run(self):
        """Test exécution de l'algorithme King"""
        # Implémentez votre algorithme King ici
        pass
```

## Exécution des Tests

```bash
# Tous les tests
python manage.py test

# Tests d'une app spécifique
python manage.py test api

# Tests d'une classe spécifique
python manage.py test api.tests.MachineModelTest

# Test spécifique
python manage.py test api.tests.MachineModelTest.test_machine_creation

# Avec verbosité
python manage.py test --verbosity=2

# Avec couverture de code (installer coverage)
pip install coverage
coverage run --source='.' manage.py test
coverage report
coverage html  # Génère un rapport HTML
```

## Tests de Performance

```python
from django.test import TestCase
from django.utils import timezone
import time

class PerformanceTest(TestCase):
    def test_machine_query_performance(self):
        """Test performance des requêtes machines"""
        # Créer 1000 machines
        machines = [
            Machine(code=f'M{i}', name=f'Machine {i}')
            for i in range(1000)
        ]
        Machine.objects.bulk_create(machines)
        
        start = time.time()
        list(Machine.objects.all())
        duration = time.time() - start
        
        self.assertLess(duration, 0.1, "Query too slow")

    def test_king_algorithm_performance(self):
        """Test performance de l'algorithme King"""
        # Créer dataset de taille moyenne
        # Mesurer le temps d'exécution
        pass
```

## Tests d'Intégration

```python
from django.test import TestCase
from rest_framework.test import APIClient

class IntegrationTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_complete_workflow(self):
        """Test flux complet : créer machines, produits, routes, exécuter King"""
        
        # 1. Créer une machine
        machine_response = self.client.post('/api/machines/', {
            'code': 'M1',
            'name': 'Tour CN 1'
        })
        self.assertEqual(machine_response.status_code, 201)
        
        # 2. Créer un produit
        product_response = self.client.post('/api/products/', {
            'code': 'P1',
            'name': 'Axe moteur',
            'volume': 500
        })
        self.assertEqual(product_response.status_code, 201)
        
        # 3. Créer une route
        route_response = self.client.post('/api/operation-routes/', {
            'product': product_response.data['id'],
            'machine': machine_response.data['id'],
            'sequence_order': 1
        })
        self.assertEqual(route_response.status_code, 201)
        
        # 4. Exécuter King
        king_response = self.client.post('/api/king-algorithm/run/')
        self.assertEqual(king_response.status_code, 200)
```

## Configuration Coverage

Créez `.coveragerc` :

```ini
[run]
source = .
omit = 
    */migrations/*
    */tests/*
    */venv/*
    */env/*
    manage.py

[report]
exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError
    if __name__ == .__main__.:
```

## CI/CD avec GitHub Actions

Créez `.github/workflows/django-tests.yml` :

```yaml
name: Django Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        pip install -r requirements.txt
        pip install coverage
    
    - name: Run tests
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      run: |
        coverage run manage.py test
        coverage report
        coverage xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

---

Lancez les tests régulièrement pour assurer la qualité de votre backend Django !
