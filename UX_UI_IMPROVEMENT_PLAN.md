# Plan d'amélioration UX/UI — Palz Frontend

> Audit réalisé sur l'app React Native + Expo (`frontend/Palz`). ~22 000 lignes, 44 fichiers JSX/JS.
> Objectif : améliorer la cohérence visuelle, le ressenti d'utilisation et la maintenabilité.

---

## Constat global

L'app a déjà de bonnes fondations (palette rose/lavande cohérente, Poppins, skeletons, animations Reanimated soignées, snackbar animé). **Mais** ces fondations sont systématiquement contournées :

| Problème | Mesure | Gravité |
|----------|--------|---------|
| Couleurs hardcodées au lieu du thème | 750+ hex en dur vs ~36 usages de `getColors()` | 🔴 Critique |
| 8 fichiers redéfinissent leur propre `PALETTE` locale | login, signup, editing_profil, payement_*, onboarding, MapPicker, template_empty_page | 🔴 Critique |
| Pas de composant `Button` partagé | 472 `TouchableOpacity` bruts | 🔴 Critique |
| Pas de composant `Input` partagé | ~50 `TextInput` bruts | 🔴 Critique |
| `ThemedText` quasi inutilisé | 6 fichiers / 44 | 🔴 Critique |
| Erreurs en `Alert.alert()` bloquant | 156 occurrences | 🔴 Critique |
| Zéro accessibilité | 0 `accessibilityLabel` / `accessibilityRole` | 🔴 Critique |
| Dark mode défini mais jamais appliqué | `Colors.dark` inutilisé | 🟠 Élevé |
| Pas d'échelle de border-radius / shadow | 60+ radius en dur (2→70px) | 🟠 Élevé |
| Validation de formulaire incohérente | email inline OK, reste en Alert | 🟠 Élevé |
| 2 écrans monstres | onboarding 2634 l., groups 2743 l. | 🟠 Élevé |
| Strings 100% en dur (français) | aucun système i18n | 🟡 Moyen |
| Polling multiple (chat 10s, conv 30s, groups 30s) | pas de WebSocket | 🟡 Moyen |

---

## PHASE 0 — Design System (socle, à faire en premier)

C'est la racine de 80 % des problèmes. Tout le reste s'appuie dessus.

### 0.1 Étendre les design tokens — `src/constants/theme.js`
- Ajouter une échelle **`Radius`** : `sm:8, md:12, lg:16, xl:20, pill:999`.
- Ajouter une échelle **`Shadow`** (3 niveaux : `card`, `floating`, `modal`) au lieu des `shadowOffset/Opacity/Radius/elevation` recopiés partout.
- Ajouter une échelle **`Typography`** complète (size + lineHeight + weight) : `caption, body, bodyLg, h3, h2, h1, display` — actuellement seuls les types de `ThemedText` existent et sont sous-utilisés.
- Ajouter une échelle **`Motion`** : `fast:200, normal:350, slow:500` + courbes (reprendre celles de `use-screen-animation.js`).
- Compléter `Spacing` si besoin (déjà bon : `half/one/two/three/four/five/six`).

### 0.2 Créer les primitives UI manquantes — `src/components/ui/`
Créer 6 composants réutilisables (les plus rentables) :

| Composant | Remplace | API minimale |
|-----------|----------|--------------|
| `Button.jsx` | 472 `TouchableOpacity` | `variant` (primary/secondary/ghost/danger), `size` (sm/md/lg), `loading`, `disabled`, `icon`, `+ haptics` |
| `Input.jsx` | ~50 `TextInput` | `label`, `error`, `icon`, `helperText`, états focus/erreur intégrés |
| `Card.jsx` | ~20 layouts | `padding`, `radius`, `shadow` via tokens |
| `Avatar.jsx` | `Image` partout | `size`, fallback initiales/icône unifié, placeholder |
| `Chip.jsx` / `Badge.jsx` | tags events/groups/messages | `variant`, `selected` |
| `AppModal.jsx` | `Modal` brut | overlay, animation slide, fermeture tap/back cohérente |

→ Réutiliser l'existant : `ThemedText`, `ThemedView`, `useTheme`, `useBounceOnChange` (haptique visuelle).

### 0.3 Migrer progressivement vers le thème
- Supprimer les 8 `PALETTE` locales → importer depuis `theme.js`.
- Remplacer les hex en dur écran par écran par les tokens.
- Migrer textes vers `ThemedText`, conteneurs vers `ThemedView`.
- **Stratégie** : commencer par les écrans auth (login/signup/landing) qui ont une PALETTE locale, puis les écrans les plus visités (index/swipe, messages, profile).

**Impact attendu** : cohérence visuelle immédiate, dark mode activable « gratuitement », divise par ~10 la dette de style.

---

## PHASE 1 — Feedback & gestion d'erreurs (quick wins à fort impact)

### 1.1 Remplacer `Alert.alert()` par le snackbar non-bloquant
- Le contexte `useSnackbar()` existe déjà (`src/contexts/snackbar.jsx`, `AnimatedSnackbar.jsx` avec 5 variantes) mais n'est utilisé que sur quelques écrans.
- Remplacer les 156 `Alert.alert()` d'erreur/succès par `snackbar.error()` / `.success()`.
- **Garder `Alert`** uniquement pour les confirmations destructives (logout, suppression compte) → là c'est justifié.

### 1.2 Supprimer les échecs silencieux
- ~20+ `.catch(() => {})` avalent les erreurs réseau/permissions/storage.
- Au minimum logger + snackbar discret pour ne pas laisser l'utilisateur dans le flou.

### 1.3 Indicateur de statut réseau
- Bandeau haut d'écran « Pas de connexion » via `@react-native-community/netinfo` (probablement déjà transitivement présent).
- Bouton « réessayer » sur les écrans de chargement échoué (swipe, messages).

### 1.4 Feedback d'upload
- Les uploads (photo 45s, vidéo 120s, audio) n'affichent qu'un spinner + « Photo... ».
- Ajouter une progression ou au moins un texte d'état clair après ~10s.

---

## PHASE 2 — Formulaires & onboarding

### 2.1 Validation inline cohérente
- L'email a une validation inline (bordure rouge + message) — c'est le bon pattern.
- Étendre ce pattern à : username, password, nom, dates, lieux (actuellement en Alert).
- Centraliser dans `src/utils/validation.js` (existe déjà).
- Ajouter un **indicateur de force de mot de passe** au signup.

### 2.2 Onboarding (11 étapes, 2634 lignes) — point de décrochage majeur
- **Barre de progression visible** « Étape 3/11 » (actuellement seulement des points pour les 2 premières étapes).
- **Navigation arrière** entre étapes (absente aujourd'hui).
- **Save-and-resume** : persister l'avancement pour reprendre plus tard.
- **Écran de complétion** célébrant la fin avant la redirection (confetti existe déjà via `ConfettiCannon.jsx`).
- **Refactor technique** : découper `onboarding.jsx` en sous-composants par étape (le fichier mélange logique + style + validation + détection de visage TensorFlow).
- Charger `@vladmandic/human` (face detection) en **lazy** — il bloque potentiellement le thread principal.

### 2.3 Édition profil & création d'événement
- **Warning « modifications non sauvegardées »** avant de quitter (`editing_profil.jsx`, `event/create.jsx`).
- Remplacer la saisie de date manuelle (« AAAA-MM-JJ ») par le `DateTimePicker` déjà importé.
- Compteur de caractères sur les descriptions.
- Validation inline (créneau hors 72h, etc.) au lieu de l'alerte au submit.

---

## PHASE 3 — Performance & temps réel

### 3.1 Mémoïsation des écrans critiques
- `index.jsx` (swipe) : `parseUserInterests(user)` recalculé à chaque render → `useMemo`.
- `AnimatedCardWrapper`, `PhotoGallery` → `React.memo`.
- Chat : extraire `renderItem` en composant mémoïsé, ajouter `maxToRenderPerBatch` / `windowSize` sur les `FlatList`.

### 3.2 Consolider le polling
- Aujourd'hui : chat 10s + conversations 30s + groups 30s, intervalles qui peuvent s'accumuler.
- Centraliser dans un service unique et **migrer vers WebSocket/SSE** pour le chat (latence perçue actuelle ≈ 10s).
- Auditer le cleanup de tous les `setInterval` / `useFocusEffect`.

### 3.3 Images
- Placeholders blurhash ou skeleton pendant le chargement (avatars, mur, chat).
- Cache d'images (`expo-image` remplace `Image` avec cache + transitions + blurhash intégrés — fortement recommandé).
- Compression côté client avant upload.
- Persister les ratios d'aspect du mur (recalculés à chaque refresh actuellement).

---

## PHASE 4 — Cohérence & polish

### 4.1 Micro-interactions
- **Haptique** sur les boutons principaux (`expo-haptics`) — actuellement aucun retour tactile.
- Standardiser les durées d'animation via les tokens `Motion`.
- États pressed/hover cohérents (activeOpacity varie 0.7/0.8/0.85).

### 4.2 États vides cohérents
- Unifier le pattern (icône + titre + sous-texte + CTA) via un composant `EmptyState` (s'appuyer sur `template_empty_page.jsx`).
- **Corriger** : l'état vide Messages renvoie vers `/(tabs)` au lieu de l'écran de swipe.

### 4.3 Réactions chat
- Gérer le wrap / « +2 » quand trop de réactions sur un message (débordement sur petits écrans).
- Miniature image dans la citation de réponse (actuellement « Photo »).

---

## PHASE 5 — Accessibilité & i18n (fond, plus long terme)

### 5.1 Accessibilité (actuellement 0 attribut)
- `accessibilityLabel` + `accessibilityRole` sur les boutons-icônes et images.
- Cibles tactiles ≥ 44×44.
- `accessibilityViewIsModal` sur les modaux + détection reduce-motion.
- Vérifier les contrastes WCAG AA (surtout le dark mode défini mais non testé).
- → Largement facilité si Phase 0 est faite (labels centralisés dans `Button`/`Input`).

### 5.2 Internationalisation
- Strings 100 % en dur en français aujourd'hui.
- Introduire `i18next` + `expo-localization`, extraire les strings vers des fichiers de traduction.
- Gérer la pluralisation (« 1 place » / « 2 places » actuellement manuel).
- Pas urgent si une seule langue visée à court terme — mais l'extraction facilite aussi le ton/copywriting.

---

## Ordre d'exécution recommandé

```
Phase 0 (Design System)  ← socle, débloque tout le reste
        │
        ├─► Phase 1 (Feedback/erreurs)   ← quick wins, gros impact ressenti
        ├─► Phase 2 (Formulaires/onboarding) ← réduit le décrochage
        │
        ├─► Phase 3 (Perf/temps réel)
        ├─► Phase 4 (Polish/cohérence)
        └─► Phase 5 (A11y/i18n)           ← fond, continu
```

**Si on ne devait faire que 3 choses :**
1. Phase 0.2 — créer `Button` + `Input` + thématiser (cohérence instantanée sur toute l'app).
2. Phase 1.1 — snackbar à la place des 156 `Alert.alert()` (l'app cesse d'être « bloquante »).
3. Phase 2.2 — barre de progression + retour arrière sur l'onboarding (réduit le décrochage à l'inscription).

---

## Fichiers de référence clés

- Thème : `src/constants/theme.js`, `src/hooks/use-theme.js`, `src/global.css`
- Primitives existantes : `src/components/themed-text.jsx`, `themed-view.jsx`, `Skeleton.jsx`, `AnimatedSnackbar.jsx`
- Animations : `src/hooks/use-screen-animation.js`
- Feedback : `src/contexts/snackbar.jsx`
- Écrans lourds à refactorer : `src/app/onboarding.jsx`, `src/app/(tabs)/groups.jsx`, `src/app/(tabs)/profil/editing_profil.jsx`
- Validation : `src/utils/validation.js`, `src/utils/parsers.js`
- API/images : `src/services/api.js` (`getStorageUrl`), `src/services/cache.js`
