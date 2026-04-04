# Manufacturing Analytics App — Django + React

## Structure du projet
```
manufacturing-app/
├── backend/          # Django REST API
│   ├── config/       # Settings, URLs
│   ├── manufacturing/ # App (models, views, serializers)
│   └── db.sqlite3    # Base de données
├── frontend/
│   └── index.html    # App React standalone
└── seed_demo.py      # Données de démo
```

## Lancement

### Backend Django
```bash
cd backend
pip install django djangorestframework django-cors-headers pandas openpyxl
python manage.py migrate
python manage.py runserver 8000
```

### Frontend
Ouvrir `frontend/index.html` dans le navigateur.
L'app fonctionne en mode démo sans API, et se connecte automatiquement quand Django tourne.

## API Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/companies/` | GET, POST | Lister / créer entreprises |
| `/api/companies/{id}/machines/` | GET, POST | Machines |
| `/api/companies/{id}/products/` | GET, POST | Produits & gammes |
| `/api/companies/{id}/flows/` | GET, POST | Flux inter-machines |
| `/api/companies/{id}/analytics/` | GET | Toutes les analytics |
| `/api/companies/{id}/import/` | POST | Import Excel/CSV |

## Format CSV/Excel pour l'import

### Gammes (routing):
| reference | name | batch_size | gamme |
|-----------|------|-----------|-------|
| 23-0029-00 | Circuit AVL-1 | 50 | A-D-E-F-G |
| 26-0022-00 | Circuit AVL-4 | 25 | A-B-C-D-E-F-G |

### Machines:
| code | name | cell |
|------|------|------|
| A | Alimentation | 1 |
| B | Bobinage | 1 |
