# Algorithme King - Documentation Technique

## Introduction

L'algorithme King est une méthode d'ordonnancement binaire utilisée pour la formation de cellules de fabrication (îlots). Il réorganise la matrice d'incidence machines-produits pour faire émerger des blocs diagonaux, chaque bloc représentant un îlot optimal.

## Principe de Base

### Matrice d'Incidence

La matrice d'incidence est une matrice binaire de taille M × P où :
- M = nombre de machines
- P = nombre de produits
- Valeur 1 = la machine i est utilisée pour le produit j
- Valeur 0 = la machine i n'est pas utilisée pour le produit j

Exemple :
```
        P1  P2  P3  P4
M1      1   1   0   0
M2      1   0   0   1
M3      0   1   0   0
M4      0   0   1   1
```

## Algorithme en 5 Étapes

### Étape 1 : Création de la Matrice d'Incidence

```typescript
createIncidenceMatrix(): number[][] {
  const matrix: number[][] = [];
  
  for (let i = 0; i < machines.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < products.length; j++) {
      // Vérifier si machine i est utilisée pour produit j
      const hasOperation = routes.some(
        r => r.machine_id === machines[i].id && 
             r.product_id === products[j].id
      );
      row.push(hasOperation ? 1 : 0);
    }
    matrix.push(row);
  }
  
  return matrix;
}
```

### Étape 2 : Conversion Binaire → Décimal

Chaque ligne (machine) et colonne (produit) est convertie en nombre décimal.

**Pour une ligne** (machines) :
```
Ligne [1, 1, 0, 0] = 1×2³ + 1×2² + 0×2¹ + 0×2⁰ = 8 + 4 = 12
```

**Pour une colonne** (produits) :
```
Colonne [1, 1, 0, 0]ᵀ = 1×2³ + 1×2² + 0×2¹ + 0×2⁰ = 12
```

```typescript
private binaryRowToDecimal(row: number[]): number {
  return row.reduce(
    (acc, val, idx) => acc + val * Math.pow(2, row.length - 1 - idx), 
    0
  );
}

private binaryColToDecimal(matrix: number[][], colIdx: number): number {
  const col = matrix.map(row => row[colIdx]);
  return col.reduce(
    (acc, val, idx) => acc + val * Math.pow(2, col.length - 1 - idx), 
    0
  );
}
```

### Étape 3 : Ordonnancement des Lignes

Les lignes (machines) sont triées par ordre décroissant de leur valeur décimale.

```typescript
orderRows(matrix: number[][], machineOrder: number[]) {
  const rowsWithDecimal = matrix.map((row, idx) => ({
    row,
    machineId: machineOrder[idx],
    decimal: this.binaryRowToDecimal(row)
  }));

  // Tri décroissant
  rowsWithDecimal.sort((a, b) => b.decimal - a.decimal);

  return {
    matrix: rowsWithDecimal.map(r => r.row),
    order: rowsWithDecimal.map(r => r.machineId)
  };
}
```

### Étape 4 : Ordonnancement des Colonnes

Les colonnes (produits) sont triées par ordre décroissant de leur valeur décimale.

```typescript
orderColumns(matrix: number[][], productOrder: number[]) {
  const colsWithDecimal = productOrder.map((productId, idx) => ({
    colIdx: idx,
    productId,
    decimal: this.binaryColToDecimal(matrix, idx)
  }));

  // Tri décroissant
  colsWithDecimal.sort((a, b) => b.decimal - a.decimal);

  // Réorganiser les colonnes
  const reorderedMatrix = matrix.map(row => 
    colsWithDecimal.map(col => row[col.colIdx])
  );

  return {
    matrix: reorderedMatrix,
    order: colsWithDecimal.map(c => c.productId)
  };
}
```

### Étape 5 : Itération jusqu'à Convergence

Les étapes 3 et 4 sont répétées jusqu'à ce que la matrice ne change plus.

```typescript
runKingAlgorithm(): KingAlgorithmResult {
  let currentMatrix = this.createIncidenceMatrix();
  let machineOrder = machines.map(m => m.id);
  let productOrder = products.map(p => p.id);

  const maxIterations = 10;
  let prevMatrix: number[][] = [];

  for (let i = 0; i < maxIterations; i++) {
    // Ordonner les lignes
    const rowResult = this.orderRows(currentMatrix, machineOrder);
    currentMatrix = rowResult.matrix;
    machineOrder = rowResult.order;

    // Ordonner les colonnes
    const colResult = this.orderColumns(currentMatrix, productOrder);
    currentMatrix = colResult.matrix;
    productOrder = colResult.order;

    // Vérifier la convergence
    if (this.matricesEqual(currentMatrix, prevMatrix)) {
      break;
    }
    prevMatrix = currentMatrix.map(row => [...row]);
  }

  // Détecter les blocs diagonaux (îlots)
  const cellBlocks = this.detectCellBlocks(currentMatrix);
  
  return { currentMatrix, cellBlocks, ... };
}
```

## Détection des Blocs Diagonaux

Après convergence, la matrice réordonnée présente des blocs diagonaux de 1. Chaque bloc représente un îlot.

```
Matrice réordonnée :
        P1  P2  P4  P3
M1      1   1   0   0  ← Bloc 1
M2      1   1   0   0  ← Bloc 1
M4      0   0   1   1  ← Bloc 2
M3      0   0   1   1  ← Bloc 2
```

### Algorithme de Détection

```typescript
private detectCellBlocks(matrix: number[][]): CellBlock[] {
  const blocks: CellBlock[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[0].length; j++) {
      if (matrix[i][j] === 1 && !visited.has(`${i},${j}`)) {
        // Démarrer un nouveau bloc
        const block = this.expandBlock(matrix, i, j, visited);
        blocks.push(block);
      }
    }
  }

  return blocks;
}
```

## Métriques de Performance

### Flux Intra-Îlots
Flux matière entre machines du **même îlot** (à maximiser).

### Flux Inter-Îlots
Flux matière entre machines de **différents îlots** (à minimiser).

### Score d'Efficacité

```
Efficacité = Flux_Intra / (Flux_Intra + Flux_Inter)
```

Score optimal = 100% (aucun flux inter-îlots).

## Exemple Complet

### Données Initiales

**Machines** : M1, M2, M3, M4  
**Produits** : P1, P2, P3, P4

**Gammes** :
- P1 : M1 → M2
- P2 : M1 → M2
- P3 : M3 → M4
- P4 : M3 → M4

### Matrice Originale

```
        P1  P2  P3  P4
M1      1   1   0   0
M2      1   1   0   0
M3      0   0   1   1
M4      0   0   1   1
```

### Conversion en Décimal

**Lignes** :
- M1 : [1,1,0,0] = 12
- M2 : [1,1,0,0] = 12
- M3 : [0,0,1,1] = 3
- M4 : [0,0,1,1] = 3

**Colonnes** :
- P1 : [1,1,0,0]ᵀ = 12
- P2 : [1,1,0,0]ᵀ = 12
- P3 : [0,0,1,1]ᵀ = 3
- P4 : [0,0,1,1]ᵀ = 3

### Après Tri (convergence immédiate)

La matrice est déjà optimale ! Deux blocs diagonaux :

```
        P1  P2  P3  P4
M1      1   1   0   0  ← Îlot 1
M2      1   1   0   0  ← Îlot 1
M3      0   0   1   1  ← Îlot 2
M4      0   0   1   1  ← Îlot 2
```

**Îlot 1** : M1, M2 (produits P1, P2)  
**Îlot 2** : M3, M4 (produits P3, P4)

**Efficacité** : 100% (aucun flux inter-îlots)

## Cas Complexes

### Pièces Exceptionnelles

Certaines pièces peuvent nécessiter des machines de plusieurs îlots. L'algorithme minimise ces cas mais ne les élimine pas toujours complètement.

Exemple :
```
P5 : M1 (Îlot 1) → M3 (Îlot 2)
```

Ce produit génère un **flux inter-îlots** qui réduit le score d'efficacité.

### Solutions

1. **Dupliquer une machine** dans l'autre îlot
2. **Créer un îlot dédié** pour les pièces exceptionnelles
3. **Accepter le flux inter-îlots** si le volume est faible

## Implémentation Backend (Optionnel)

L'algorithme peut aussi être implémenté côté Django :

```python
import numpy as np
from typing import List, Tuple

def binary_to_decimal(binary_array: List[int]) -> int:
    return sum(val * (2 ** (len(binary_array) - 1 - idx)) 
               for idx, val in enumerate(binary_array))

def king_algorithm(matrix: np.ndarray, max_iter: int = 10) -> np.ndarray:
    current = matrix.copy()
    
    for _ in range(max_iter):
        prev = current.copy()
        
        # Ordonner lignes
        row_decimals = [binary_to_decimal(row) for row in current]
        row_order = np.argsort(row_decimals)[::-1]
        current = current[row_order]
        
        # Ordonner colonnes
        col_decimals = [binary_to_decimal(current[:, i]) 
                        for i in range(current.shape[1])]
        col_order = np.argsort(col_decimals)[::-1]
        current = current[:, col_order]
        
        # Convergence ?
        if np.array_equal(current, prev):
            break
    
    return current
```

## Visualisation

L'application affiche :
1. **Matrice originale** en noir et blanc
2. **Matrice réordonnée** avec blocs colorés
3. **Diagramme SVG** des îlots sur le plan d'usine
4. **Heatmap** des flux inter-îlots

## Références

- King, J.R. (1980). "Machine-component grouping in production flow analysis: an approach using a rank order clustering algorithm"
- Kumar, K.R., & Chandrasekharan, M.P. (1990). "Grouping efficacy: a quantitative criterion for goodness of block diagonal forms"

## Conclusion

L'algorithme King est une méthode simple et efficace pour la formation d'îlots. Il converge rapidement et donne des résultats visuellement clairs grâce aux blocs diagonaux.

L'implémentation dans cette application fonctionne à la fois côté frontend (mode démo) et peut être intégrée côté backend Django pour le mode live.
