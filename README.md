# Application d'Analyse de Formation d'Îlots - Méthode King

Application web full-stack pour l'analyse de formation de cellules de fabrication (îlots) utilisant l'algorithme King (ordonnancement binaire).

## 🎯 Fonctionnalités

### Frontend React
- **Tableau de bord** : Métriques clés et graphiques (Chart.js)
- **Page Gammes** : Visualisation des gammes de fabrication (séquences de machines par produit)
- **Page Machines** : Liste des machines avec charge et affectation aux îlots
- **Page Algorithme King** : Visualisation des matrices avant/après avec blocs diagonaux colorés
- **Page Plan d'Usine** : Diagramme SVG des îlots et heatmap des flux matière
- **Page Import** : Import Excel/CSV avec drag-and-drop et saisie manuelle

### Algorithme King
- Création de la matrice d'incidence machines × produits
- Ordonnancement binaire itératif (lignes et colonnes)
- Détection automatique des blocs diagonaux (îlots)
- Calcul des flux intra-îlots et inter-îlots
- Score d'efficacité de la formation

### Modes de Fonctionnement
- **Mode Démo** : Fonctionne avec des données mock (hors ligne)
- **Mode Live** : Bascule automatiquement vers l'API Django quand disponible

## 🚀 Installation et Lancement

### Frontend (React)

1. **Installation des dépendances**
   ```bash
   npm install
   # ou
   pnpm install
   ```

2. **Configuration de l'API**
   ```bash
   cp .env.example .env
   ```
   Modifiez `.env` pour pointer vers votre serveur Django :
   ```
   VITE_API_URL=http://localhost:8000/api
   ```

3. **Lancement en mode développement**
   ```bash
   npm run dev
   ```

4. **Build de production**
   ```bash
   npm run build
   ```

### Backend Django (à développer séparément)

L'application frontend est prête à se connecter à votre API Django REST Framework. Voici les endpoints attendus :

#### Endpoints API Django

```python
# URLs attendues
GET  /api/machines/              # Liste des machines
POST /api/machines/              # Créer une machine
GET  /api/products/              # Liste des produits
POST /api/products/              # Créer un produit
GET  /api/operation-routes/      # Routes d'opération (gammes)
POST /api/operation-routes/      # Créer une route
GET  /api/material-flows/        # Flux matière
GET  /api/cells/                 # Îlots de fabrication
POST /api/king-algorithm/run/    # Exécuter l'algorithme King
GET  /api/king-algorithm/history/ # Historique des exécutions
POST /api/import/                # Import Excel/CSV
GET  /api/health/                # Health check
```

#### Modèles Django Suggérés

```python
# models.py
from django.db import models

class Machine(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    cell_id = models.IntegerField(null=True, blank=True)
    load_hours = models.FloatField(default=0)
    utilization_rate = models.FloatField(default=0)

class Product(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    volume = models.IntegerField(default=0)  # Volume de production

class OperationRoute(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    machine = models.ForeignKey(Machine, on_delete=models.CASCADE)
    sequence_order = models.IntegerField()  # Ordre dans la gamme
    operation_time = models.FloatField(null=True, blank=True)  # Temps en heures

class MaterialFlow(models.Model):
    from_machine = models.ForeignKey(Machine, related_name='flows_from', on_delete=models.CASCADE)
    to_machine = models.ForeignKey(Machine, related_name='flows_to', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    flow_volume = models.IntegerField()  # En UL (unités de liaison)

class Cell(models.Model):
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=200)
    machine_ids = models.JSONField()  # Liste d'IDs de machines
    color = models.CharField(max_length=7)  # Couleur hex

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
```

#### Import Excel/CSV avec Pandas

```python
# views.py
import pandas as pd
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['POST'])
def import_data(request):
    file = request.FILES.get('file')
    
    if file.name.endswith('.xlsx') or file.name.endswith('.xls'):
        # Excel
        machines_df = pd.read_excel(file, sheet_name='Machines')
        products_df = pd.read_excel(file, sheet_name='Produits')
        routes_df = pd.read_excel(file, sheet_name='Gammes')
    else:
        # CSV
        machines_df = pd.read_csv(file)
    
    # Traiter et importer dans la base de données
    # ...
    
    return Response({'success': True, 'message': 'Import réussi'})
```

## 📊 Format des Fichiers d'Import

### Excel (.xlsx)
Le fichier doit contenir 3 feuilles :

1. **Feuille "Machines"**
   | Code | Nom | Description |
   |------|-----|-------------|
   | M1   | Tour CN 1 | Tour à commande numérique |
   | M2   | Fraiseuse 1 | Fraiseuse conventionnelle |

2. **Feuille "Produits"**
   | Code | Nom | Volume | Description |
   |------|-----|--------|-------------|
   | P1   | Axe moteur A100 | 500 | Axe pour moteur série A |
   | P2   | Bride B200 | 350 | Bride de fixation |

3. **Feuille "Gammes"**
   | Code Produit | Code Machine | Ordre Séquence | Temps Opération |
   |--------------|--------------|----------------|-----------------|
   | P1           | M1           | 1              | 0.5             |
   | P1           | M2           | 2              | 0.3             |

### CSV
Trois fichiers CSV séparés avec les mêmes colonnes que ci-dessus.

## 🧮 Algorithme King - Détails Techniques

L'algorithme King est implémenté côté frontend (pour le mode démo) et peut être réimplémenté côté backend Django :

1. **Création de la matrice d'incidence** : Matrice binaire machines × produits (1 si la machine est utilisée pour le produit)
2. **Conversion binaire en décimal** : Chaque ligne et colonne est convertie en nombre décimal
3. **Tri décroissant** : Les lignes et colonnes sont triées par valeur décimale décroissante
4. **Itération** : Le processus est répété jusqu'à convergence
5. **Détection des blocs** : Les blocs diagonaux de 1 représentent les îlots
6. **Calcul d'efficacité** : Score = flux intra-îlots / flux total

## 🎨 Technologies Utilisées

### Frontend
- **React 18** avec TypeScript
- **React Router** pour la navigation
- **Chart.js** + react-chartjs-2 pour les graphiques
- **Tailwind CSS v4** pour le style
- **Lucide React** pour les icônes
- **Sonner** pour les notifications
- **Radix UI** pour les composants

### Backend (à implémenter)
- **Django REST Framework**
- **PostgreSQL** pour la base de données
- **Pandas** pour l'import Excel/CSV

## 📝 Structure du Projet

```
/src
  /app
    /components
      /ui          # Composants UI réutilisables
      RootLayout.tsx
    /pages
      Dashboard.tsx
      GammesPage.tsx
      MachinesPage.tsx
      KingAlgorithmPage.tsx
      FactoryFloorPage.tsx
      ImportPage.tsx
      NotFound.tsx
    /services
      api.ts              # Service API avec basculement démo/live
      kingAlgorithm.ts    # Implémentation algorithme King
      mockData.ts         # Données de démonstration
    /types
      index.ts            # Types TypeScript
    App.tsx
    routes.tsx
```

## 🔧 Configuration

### Variables d'Environnement

```bash
# .env
VITE_API_URL=http://localhost:8000/api
```

L'application détecte automatiquement si l'API est disponible et bascule entre mode démo et mode live.

## 📸 Captures d'Écran

L'application affiche :
- **Tableau de bord** avec KPI et graphiques circulaires/barres
- **Matrices King** avec blocs diagonaux colorés par îlot
- **Diagramme SVG** du plan d'usine avec flèches de flux
- **Heatmap** des flux inter-îlots

## 🤝 Contribution

Pour développer le backend Django :

1. Créez un projet Django avec PostgreSQL
2. Implémentez les modèles et endpoints listés ci-dessus
3. Activez CORS pour permettre les requêtes du frontend
4. Implémentez l'algorithme King côté serveur (optionnel, déjà fait en frontend)
5. Ajoutez l'import Excel/CSV avec pandas

## 📄 Licence

Ce projet est un exemple d'application industrielle pour l'analyse de formation d'îlots de fabrication.

---

**Note** : L'application fonctionne entièrement en mode démo sans backend. Connectez votre API Django pour activer le mode live avec persistance des données.
