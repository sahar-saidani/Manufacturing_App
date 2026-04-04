# Script Python pour générer un fichier Excel d'exemple
# Exécutez: python generate_example_excel.py

import pandas as pd

# Données exemple pour les machines
machines_data = {
    'Code': ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
    'Nom': [
        'Tour CN 1', 'Fraiseuse 1', 'Perceuse 1', 'Rectifieuse 1',
        'Tour CN 2', 'Fraiseuse CN', 'Presse 1', 'Poinçonneuse',
        'Plieuse', 'Soudure TIG', 'Soudure MIG', 'Polisseuse'
    ],
    'Description': [
        'Tour à commande numérique', 'Fraiseuse conventionnelle', 'Perceuse radiale',
        'Rectifieuse plane', 'Tour à commande numérique', 'Fraiseuse à commande numérique',
        'Presse hydraulique 100T', 'Poinçonneuse CNC', 'Plieuse hydraulique',
        'Poste soudure TIG', 'Poste soudure MIG', 'Polisseuse automatique'
    ]
}

# Données exemple pour les produits
products_data = {
    'Code': ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
    'Nom': [
        'Axe moteur A100', 'Bride B200', 'Carter C300', 'Pignon D400',
        'Boîtier E500', 'Support F600', 'Capot G700', 'Plaque H800'
    ],
    'Volume': [500, 350, 280, 450, 320, 400, 250, 380],
    'Description': [
        'Axe pour moteur série A', 'Bride de fixation', 'Carter de protection',
        'Pignon denté 24 dents', 'Boîtier électronique', 'Support de montage',
        'Capot de protection', 'Plaque support'
    ]
}

# Données exemple pour les gammes de fabrication
gammes_data = {
    'Code Produit': [
        'P1', 'P1', 'P1',  # Axe moteur: M1 -> M2 -> M4
        'P2', 'P2', 'P2',  # Bride: M1 -> M3 -> M5
        'P3', 'P3', 'P3',  # Carter: M7 -> M8 -> M9
        'P4', 'P4', 'P4',  # Pignon: M5 -> M6 -> M4
        'P5', 'P5', 'P5',  # Boîtier: M7 -> M9 -> M10
        'P6', 'P6', 'P6',  # Support: M10 -> M11 -> M12
        'P7', 'P7', 'P7',  # Capot: M8 -> M9 -> M11
        'P8', 'P8', 'P8'   # Plaque: M2 -> M3 -> M6
    ],
    'Code Machine': [
        'M1', 'M2', 'M4',
        'M1', 'M3', 'M5',
        'M7', 'M8', 'M9',
        'M5', 'M6', 'M4',
        'M7', 'M9', 'M10',
        'M10', 'M11', 'M12',
        'M8', 'M9', 'M11',
        'M2', 'M3', 'M6'
    ],
    'Ordre Séquence': [
        1, 2, 3,
        1, 2, 3,
        1, 2, 3,
        1, 2, 3,
        1, 2, 3,
        1, 2, 3,
        1, 2, 3,
        1, 2, 3
    ],
    'Temps Opération': [
        0.5, 0.3, 0.4,
        0.4, 0.2, 0.3,
        0.6, 0.4, 0.5,
        0.7, 0.5, 0.3,
        0.5, 0.4, 0.6,
        0.8, 0.6, 0.4,
        0.5, 0.4, 0.5,
        0.6, 0.3, 0.5
    ]
}

# Créer les DataFrames
df_machines = pd.DataFrame(machines_data)
df_products = pd.DataFrame(products_data)
df_gammes = pd.DataFrame(gammes_data)

# Créer le fichier Excel avec plusieurs feuilles
filename = 'exemple_import_manufacturing.xlsx'

with pd.ExcelWriter(filename, engine='openpyxl') as writer:
    df_machines.to_excel(writer, sheet_name='Machines', index=False)
    df_products.to_excel(writer, sheet_name='Produits', index=False)
    df_gammes.to_excel(writer, sheet_name='Gammes', index=False)

print(f"✅ Fichier '{filename}' créé avec succès!")
print(f"\nContenu:")
print(f"  - {len(df_machines)} machines")
print(f"  - {len(df_products)} produits")
print(f"  - {len(df_gammes)} opérations de gamme")
print(f"\nVous pouvez maintenant importer ce fichier dans l'application.")

# Créer également des fichiers CSV séparés
df_machines.to_csv('exemple_machines.csv', index=False)
df_products.to_csv('exemple_produits.csv', index=False)
df_gammes.to_csv('exemple_gammes.csv', index=False)

print(f"\n✅ Fichiers CSV également créés:")
print(f"  - exemple_machines.csv")
print(f"  - exemple_produits.csv")
print(f"  - exemple_gammes.csv")
