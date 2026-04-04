# 🚀 Démarrage Rapide

## Mode Démo (Frontend uniquement - sans backend)

L'application fonctionne **immédiatement** en mode démo avec des données d'exemple.

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer l'application
npm run dev

# 3. Ouvrir dans le navigateur
# http://localhost:5173
```

C'est tout ! L'application fonctionne avec des données mock et l'algorithme King s'exécute côté frontend.

---

## Mode Live (avec Backend Django + PostgreSQL)

### Prérequis
- Python 3.8+
- PostgreSQL
- Node.js 18+

### Étape 1 : Backend Django

```bash
# Créer et activer un environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou venv\Scripts\activate  # Windows

# Installer les dépendances
pip install django djangorestframework django-cors-headers psycopg2-binary pandas openpyxl

# Créer la base de données PostgreSQL
createdb manufacturing_db

# Créer le projet (voir DJANGO_SETUP.md pour le code complet)
django-admin startproject manufacturing_backend
cd manufacturing_backend
python manage.py startapp api

# Configurer selon DJANGO_SETUP.md

# Faire les migrations
python manage.py makemigrations
python manage.py migrate

# Lancer le serveur Django
python manage.py runserver
```

### Étape 2 : Frontend React

```bash
# Dans un autre terminal, revenir au dossier du frontend
cd /chemin/vers/frontend

# Copier et configurer .env
cp .env.example .env
# Modifier VITE_API_URL=http://localhost:8000/api

# Installer et lancer
npm install
npm run dev
```

L'application détecte automatiquement que l'API Django est disponible et bascule en **mode live** !

---

## 📁 Importer des Données

### Option 1 : Utiliser le fichier Excel d'exemple

```bash
# Générer un fichier Excel d'exemple
pip install pandas openpyxl
python generate_example_excel.py
```

Puis dans l'application, allez sur la page **Import** et glissez-déposez le fichier `exemple_import_manufacturing.xlsx`.

### Option 2 : Créer votre propre fichier Excel

Créez un fichier Excel avec 3 feuilles :

1. **Machines** : Code, Nom, Description
2. **Produits** : Code, Nom, Volume, Description
3. **Gammes** : Code Produit, Code Machine, Ordre Séquence, Temps Opération

### Option 3 : Saisie manuelle

Utilisez les formulaires dans la page **Import** pour ajouter machines et produits un par un.

---

## 🧮 Utiliser l'Algorithme King

1. Allez sur la page **Algorithme King**
2. Cliquez sur **Exécuter l'algorithme**
3. Visualisez :
   - La matrice d'incidence originale
   - La matrice réordonnée avec les blocs diagonaux colorés
   - Les îlots formés avec leurs machines

---

## 📊 Fonctionnalités Principales

| Page | Description |
|------|-------------|
| **Tableau de bord** | Vue d'ensemble avec KPI et graphiques |
| **Gammes** | Séquences de fabrication par produit |
| **Machines** | Liste des machines avec charge et affectation |
| **Algorithme King** | Visualisation des matrices et formation d'îlots |
| **Plan d'usine** | Diagramme SVG et heatmap des flux |
| **Import** | Import Excel/CSV ou saisie manuelle |

---

## 🔧 Résolution de Problèmes

### L'application reste en mode démo

- Vérifiez que Django tourne sur `http://localhost:8000`
- Vérifiez le fichier `.env` : `VITE_API_URL=http://localhost:8000/api`
- Vérifiez que CORS est configuré dans Django
- Testez l'API : `curl http://localhost:8000/api/health/`

### Erreur d'import Excel

- Vérifiez le format des colonnes (voir README.md)
- Assurez-vous que les noms des feuilles sont exacts : "Machines", "Produits", "Gammes"
- En mode démo, l'import est simulé (fichier non traité réellement)

### L'algorithme King ne s'exécute pas

- En mode démo : il s'exécute côté frontend automatiquement
- En mode live : vérifiez que l'endpoint `/api/king-algorithm/run/` répond

---

## 📚 Documentation Complète

- **README.md** : Documentation complète du projet
- **DJANGO_SETUP.md** : Guide détaillé pour configurer Django
- **generate_example_excel.py** : Script pour générer des données d'exemple

---

## 🎯 Prochaines Étapes

1. ✅ Tester l'application en mode démo
2. ⚙️ Configurer le backend Django (optionnel)
3. 📊 Importer vos propres données
4. 🧮 Exécuter l'algorithme King
5. 📈 Analyser les résultats et optimiser vos îlots

---

**Besoin d'aide ?** Consultez README.md pour plus de détails !
