# Configuration Environnement (.env)

Créez un fichier `.env` à la racine du projet avec le contenu suivant :

```bash
# Django API Configuration
# Remplacez cette URL par l'adresse de votre serveur Django
VITE_API_URL=http://localhost:8000/api
```

## Modes de Fonctionnement

### Mode Démo (Par défaut)
Si l'API Django n'est pas accessible, l'application fonctionne automatiquement en mode démo avec :
- Données mock (12 machines, 8 produits, 4 îlots)
- Algorithme King exécuté côté frontend
- Toutes les fonctionnalités disponibles (sauf persistance)

### Mode Live
Dès que l'API Django est accessible à l'URL configurée, l'application bascule automatiquement en mode live avec :
- Données réelles depuis PostgreSQL
- Persistance des données
- Import Excel/CSV fonctionnel
- Historique des exécutions de l'algorithme King

## Vérification du Mode

Un badge **"Mode Démo"** s'affiche dans le header quand l'application fonctionne sans backend.

## API Health Check

L'application vérifie automatiquement la disponibilité de l'API au chargement via :
```
GET http://localhost:8000/api/health/
```

Cette vérification a un timeout de 2 secondes. Si l'API ne répond pas, le mode démo est activé.

## Changement de Configuration

1. Modifiez l'URL dans `.env`
2. Redémarrez le serveur de développement
3. L'application détectera automatiquement la nouvelle configuration

## Exemples de Configuration

### Développement local
```bash
VITE_API_URL=http://localhost:8000/api
```

### Serveur distant
```bash
VITE_API_URL=https://api.mon-entreprise.com/api
```

### Docker
```bash
VITE_API_URL=http://backend:8000/api
```
