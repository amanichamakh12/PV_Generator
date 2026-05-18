# PV Automation Frontend Module

Module frontend React pour le système de génération automatique de procès-verbaux.

## 🚀 Démarrage rapide

### Installation des dépendances

```bash
npm install
```

### Démarrage en mode développement

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

### Build pour la production

```bash
npm run build
```

### Prévisualisation du build

```bash
npm run preview
```

## 📁 Structure du projet

```
frontend-react-module/
├── src/
│   ├── components/
│   │   ├── sections/
│   │   │   ├── Dashboard.jsx      # Tableau de bord avec statistiques
│   │   │   ├── UploadSection.jsx  # Section d'import de fichiers
│   │   │   ├── Documents.jsx      # Gestion des documents
│   │   │   ├── Settings.jsx       # Paramètres utilisateur
│   │   │   └── Help.jsx          # Centre d'aide
│   │   ├── Sidebar.jsx           # Navigation latérale
│   │   └── MainContent.jsx       # Conteneur principal
│   ├── App.jsx                   # Composant principal
│   ├── main.jsx                  # Point d'entrée React
│   └── index.css                 # Styles globaux
├── index.html                    # Template HTML
├── package.json                  # Configuration npm
├── vite.config.js               # Configuration Vite
└── README.md                    # Documentation
```

## 🎨 Fonctionnalités

### Navigation
- **Tableau de bord** : Vue d'ensemble avec statistiques et activités récentes
- **Importer PV** : Upload de documents avec drag & drop
- **Documents** : Gestion et consultation des PV générés
- **Paramètres** : Configuration utilisateur et système
- **Aide** : Centre d'aide avec FAQ

### Interface
- Design moderne et responsive
- Thème professionnel avec palette de couleurs cohérente
- Animations fluides et transitions
- Support mobile et desktop

### Composants
- **Sidebar** : Navigation avec icônes Lucide React
- **Cards** : Composants modulaires pour l'affichage des informations
- **Buttons** : Boutons stylisés avec états hover
- **Status badges** : Indicateurs de statut colorés
- **Forms** : Champs de saisie et sélecteurs stylisés

## 🛠️ Technologies utilisées

- **React 18** : Bibliothèque JavaScript pour les interfaces utilisateur
- **Vite** : Outil de build rapide pour le développement
- **Lucide React** : Bibliothèque d'icônes
- **CSS Variables** : Système de design avec variables CSS
- **Google Fonts** : Polices DM Serif Display et DM Sans

## 🎯 Personnalisation

### Couleurs
Modifiez les variables CSS dans `src/index.css` :

```css
:root {
  --navy: #1B3A6B;           /* Couleur principale */
  --accent: #E8A020;         /* Couleur d'accent */
  --bg: #F7F8FA;            /* Fond */
  --surface: #FFFFFF;       /* Surfaces */
  --text: #1A1F2E;          /* Texte principal */
  --muted: #6B7280;         /* Texte secondaire */
}
```

### Sections
Ajoutez de nouvelles sections en créant des composants dans `src/components/sections/` et en les important dans `MainContent.jsx`.

## 📱 Responsive Design

L'application s'adapte automatiquement aux différentes tailles d'écran :
- **Desktop** : Layout avec sidebar fixe
- **Mobile** : Navigation masquée, contenu en pleine largeur

## 🔧 Scripts disponibles

- `npm run dev` : Démarre le serveur de développement
- `npm run build` : Construit l'application pour la production
- `npm run preview` : Prévisualise le build de production
- `npm run lint` : Vérifie la qualité du code (ESLint)

## 🤝 Contribution

1. Fork le projet
2. Créez une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Pushez vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.