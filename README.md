# Palz 🌸

**Palz** est une application mobile de rencontre et d'amitié féminine (WLW) construite avec **React Native (Expo Router)**. Elle permet de swiper, matcher, chatter, créer des événements, rejoindre des groupes hebdomadaires et partager sur un mur social — le tout dans une expérience douce, féminine et inclusive.

---

## 📱 Stack Technique

| Couche | Technologie |
|--------|------------|
| **Framework** | React Native 0.81 + Expo SDK 54 |
| **Routage** | Expo Router (file-based routing) |
| **Navigation** | Custom bottom tab bar + stack navigation |
| **Stockage local** | react-native-mmkv + expo-secure-store |
| **HTTP** | Axios avec intercepteurs token JWT |
| **Paiements** | Stripe (via `@stripe/stripe-react-native`) |
| **Média** | expo-image-picker, expo-audio, expo-video |
| **Carte** | expo-location + MapPicker |
| **Animations** | react-native-reanimated |
| **Backend** | Node.js/Express (hébergé sur Render) |
| **Base de données** | PostgreSQL (via backend) |
| **Stockage fichiers** | Supabase Storage (photos, audios, vidéos) |
| **CI/CD** | Expo Application Services (EAS) |

---

## 🗂️ Structure du projet

```
Palz/
├── app.json                    # Configuration Expo
├── package.json
├── tsconfig.json
├── assets/                     # Icônes, images, polices
├── scripts/
│   └── reset-project.js
├── src/
│   ├── app/                    # Routes (Expo Router)
│   │   ├── _layout.jsx         # Layout racine (Stripe, Auth, GestureHandler)
│   │   ├── index.jsx           # Écran d'accueil / redirection
│   │   ├── onboarding.jsx      # Onboarding après inscription
│   │   ├── +not-found.jsx
│   │   ├── (auth)/             # Groupe auth (no tabs)
│   │   │   ├── _layout.jsx
│   │   │   ├── login.jsx
│   │   │   └── signup.jsx
│   │   └── (tabs)/             # Groupe principal avec tab bar
│   │       ├── _layout.jsx     # Layout tabs : Wall, Events, Groups, Messages, Profil
│   │       ├── index.jsx       # Écran de swipe (découverte)
│   │       ├── wall.jsx        # Mur social (posts, photos, likes)
│   │       ├── events.jsx      # Liste des événements
│   │       ├── groups.jsx      # Groupes hebdomadaires
│   │       ├── messages.jsx    # Liste des conversations
│   │       ├── profile.jsx     # Profil utilisateur
│   │       ├── chat/
│   │       │   ├── index.jsx
│   │       │   └── [id].jsx    # Chat 1:1 (texte, vocal, images, streaks 🔥)
│   │       ├── event/
│   │       │   ├── create.jsx  # Création d'événement
│   │       │   └── [id].jsx    # Détail événement
│   │       ├── profil/
│   │       │   ├── editing_profil.jsx       # Édition du profil
│   │       │   ├── payement_page.jsx        # Page d'abonnement Premium
│   │       │   └── payement_redirection.jsx # Redirection Stripe
│   │       ├── settings/
│   │       │   └── list_settings.jsx        # Paramètres complets
│   │       └── user/
│   │           └── [id].jsx    # Profil public d'une autre utilisatrice
│   ├── components/             # Composants réutilisables
│   │   ├── ui/
│   │   │   └── collapsible.jsx
│   │   ├── animated-icon.jsx / .web.jsx
│   │   ├── app-tabs.jsx / .web.jsx
│   │   ├── external-link.jsx
│   │   ├── hint-row.jsx
│   │   ├── MapPicker.jsx
│   │   ├── template_empty_page.jsx
│   │   ├── themed-text.jsx
│   │   ├── themed-view.jsx
│   │   └── web-badge.jsx
│   ├── constants/
│   │   └── theme.js           # Palette rose/douce + couleurs dark mode
│   ├── contexts/
│   │   └── auth.jsx           # Contexte d'authentification (JWT)
│   ├── hooks/
│   │   ├── use-color-scheme.js / .web.js
│   │   └── use-google-auth.js
│   ├── services/
│   │   ├── api.js             # Client Axios + toutes les API (auth, users, messages, events, groups, wall, payments...)
│   │   └── storage.js         # Abstraction MMKV/SecureStore
│   ├── utils/
│   │   ├── compatibility.js
│   │   ├── parsers.js         # parseDbJson, etc.
│   │   └── validation.js
│   └── global.css
└── TODO
```

---

## 🧭 Fonctionnalités

### 🔐 Authentification
- Inscription avec email (vérification âge 18+, validation email, mot de passe hashé)
- Connexion Google (OAuth via expo-web-browser)
- JWT stocké dans SecureStore, intercepteur Axios pour refresh/invalidation auto
- Session persistante entre les lancements

### 👩‍👩‍👧 Swipe & Découverte (index.jsx)
- Swipe gauche/droite avec cartes de profils
- Filtres d'âge (min/max configurable dans les paramètres)
- Rayon de recherche (5–500 km)
- Types de relation recherchée (amitié, relation, etc.)

### 💬 Messagerie 1:1 (chat/[id].jsx)
- Messages texte, images, vocaux
- **Flame Streak 🔥** : compteur de jours consécutifs d'échange — affiché dans le badge du chat et dans la conversation
- Icebreakers générés par IA
- Signalement d'utilisatrice
- Lecture/statut vu

### 📅 Événements (event/)
- Création d'événements (titre, description, catégorie, lieu, date)
- Catégories : bar, café, parc, resto, musée, sport, concert, autre
- Sélection de lieu sur carte (MapPicker)
- Participation / RSVP
- Chat de groupe pour l'événement
- Suggestions d'événements

### 🧑‍🤝‍🧑 Groupes hebdomadaires (groups.jsx)
- Génération aléatoire de groupes chaque semaine
- Vote sur les membres, activités, lieu de rendez-vous
- Chat de groupe avec messages
- Feedback de dissolution (note du groupe, notes des membres)

### 🖼️ Mur social (wall.jsx)
- Posts photo avec thème visuel
- Réactions (likes)
- Posts des utilisatrices suivies

### 👤 Profil & Édition (profil/)
- Photos (jusqu'à 6)
- Prompt question/réponse
- Fun fact vocal (audio)
- Labels : vibe, dispo, IRL
- Localisation
- Abonnement Premium (Stripe)

### ⚙️ Paramètres (settings/list_settings.jsx)
- **Découverte** : tranche d'âge (18–60), rayon de recherche (5–500 km)
- **Notifications** : push, aperçu messages, sons
- **Confidentialité** : visibilité du profil, utilisatrices bloquées, signalement
- **Premium** : abonnement, gestion
- **Apparence** : mode sombre
- **Application** : partager, noter
- **À propos** : version, CGU, confidentialité, contact
- **Compte** : déconnexion, suppression

---

## 🎨 Thème & Design

Palette douce, féminine et cozy :

| Couleur | Usage |
|--------|-------|
| `#FF8FA3` (rose) | Accent principale |
| `#FFF0F3` (rose pâle) | Fond sélectionné |
| `#FFF9F5` (crème) | Fond clair |
| `#4A3728` (brun foncé) | Texte clair |
| `#F5F0EB` | Texte dark mode |
| `#2D2520` | Fond dark mode |

- Support complet du **mode sombre** 🌙
- Design responsive avec `Spacing` systématique

---

## 🌐 API & Backend

Backend Node.js/Express hébergé sur **Render**.
URL de base : `https://palz-backend.onrender.com/api`

### Endpoints principaux
- `POST /auth/signup` / `POST /auth/login` / `POST /auth/google`
- `GET /users/discover` / `PUT /users/profile` / `POST /users/report_user`
- `POST /swipes` / `GET /swipes/matches`
- `GET /messages/conversations` / `POST /messages/send` / `POST /messages/update_streak`
- `POST /events` / `GET /events` / `POST /events/:id/join`
- `POST /groups/generate` / `GET /groups/current`
- `GET /wall/posts` / `POST /wall/post`
- `POST /payments/create-payment-sheet` / `POST /payments/confirm`

### Stockage fichiers
- **Supabase Storage** : photos (`user_photos`), audios (`audio_users`), vidéos de vérification
- Upload via fetch multipart vers `/upload/image`, `/upload/audio`, `/upload/video-verification`

---

## 🚀 Démarrage

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement (voir .env)
# EXPO_PUBLIC_USE_LOCAL=true pour backend local
# EXPO_PUBLIC_API_KEY=votre-clé-api
# EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=votre-clé-stripe
# EXPO_PUBLIC_SUPABASE_URL=votre-url-supabase

# 3. Lancer l'application
npx expo start
```

---

## 📝 TODO

Voir le fichier `TODO` à la racine pour la liste des tâches en cours.
