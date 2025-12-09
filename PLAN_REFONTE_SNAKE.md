# 🐍 Plan de Refonte Snake - Amélioration Fluidité

## 📋 Problèmes identifiés

1. **Mouvement saccadé** : Le déplacement case par case crée un effet "choppy"
2. **Taille du damier trop grande** : 40x40 rend le jeu lent et peu dynamique
3. **Tick rate serveur** : 120ms entre chaque update est trop lent pour un jeu fluide
4. **Rendu synchronisé au tick** : Le rendu visuel n'est fait que lors des updates serveur

## 🎯 Objectifs de la refonte

1. **Mouvement fluide** : Interpolation visuelle entre les positions
2. **Damier plus petit** : Passer de 40x40 à 25x25 pour un jeu plus dynamique
3. **Rendu à 60 FPS** : Animation fluide indépendante du tick serveur
4. **Serpents plus lisses** : Courbes et transitions douces entre segments
5. **Effets visuels** : Trainée, particules, animations de mort

---

## 🔧 Modifications Techniques

### 1. Configuration du jeu

| Paramètre | Avant | Après |
|-----------|-------|-------|
| Taille grille | 40x40 | 25x25 |
| Taille cellule | 15px | 20px |
| Canvas | 600x600 | 500x500 |
| Tick serveur | 120ms | 80ms |
| Rendu client | Synchrone | 60 FPS (16ms) |

### 2. Interpolation visuelle

```
Position affichée = Position actuelle + (Direction * progression)
Progression = temps_depuis_dernier_tick / durée_tick
```

Le client interpole visuellement entre les positions pour un mouvement fluide,
même si le serveur n'envoie des updates que toutes les 80ms.

### 3. Rendu amélioré

- **Serpent arrondi** : Utilisation de courbes Bézier
- **Dégradé de couleur** : La queue est plus sombre que la tête
- **Trainée lumineuse** : Effet de glow derrière la tête
- **Animation de mort** : Explosion en particules
- **Nourriture animée** : Pulsation et rotation

---

## 📝 Étapes d'implémentation

### Phase 1 : Configuration ✅
- [x] Réduire la taille de la grille (40→25)
- [x] Augmenter la taille des cellules (15→20)
- [x] Réduire le tick rate serveur (120→80ms)

### Phase 2 : Rendu fluide
- [ ] Implémenter requestAnimationFrame pour rendu 60 FPS
- [ ] Ajouter interpolation des positions
- [ ] Stocker l'état précédent pour interpolation

### Phase 3 : Visuels améliorés
- [ ] Serpents avec segments arrondis
- [ ] Dégradé de couleur sur le corps
- [ ] Effet de glow sur la tête
- [ ] Animation pulsation nourriture

### Phase 4 : Effets
- [ ] Particules lors de la consommation de nourriture
- [ ] Animation de mort
- [ ] Trainée derrière le serpent

---

## 🎮 Résultat attendu

Un jeu Snake fluide à 60 FPS avec :
- Mouvements doux et continus
- Visuels modernes et attrayants
- Gameplay plus nerveux (grille plus petite)
- Meilleure réactivité des contrôles

---

*Plan créé le 9 décembre 2025*
