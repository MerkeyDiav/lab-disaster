# 🏗️ AWS Disaster Recovery Lab - Todo Application

Une application web monolithique ultra-simple pour démontrer les concepts de **Disaster Recovery (DR)**, **Backup**, et **Restauration** avec AWS RDS MySQL.

## 📋 Objectif Pédagogique

Cette application permet aux étudiants de :
1. **Insérer des données** dans une base de données MySQL sur AWS RDS
2. **Simuler un sinistre** (crash de la base de données)
3. **Constater la perte** de données en temps réel
4. **Restaurer les données** via AWS Backup snapshots
5. **Vérifier la récupération** des données après restauration

## 🏛️ Architecture

```
┌─────────────────────────────────────────┐
│         EC2 Instance (Ubuntu)           │
│  ┌───────────────────────────────────┐  │
│  │  Node.js/Express Server (port 3000)  │
│  │  - Serves static HTML/CSS/JS      │  │
│  │  - Provides REST API (/api/todos) │  │
│  │  - Error handling for DB failures │  │
│  └───────────────────────────────────┘  │
└──────────────────┬──────────────────────┘
                   │
                   │ TCP 3306
                   ▼
        ┌──────────────────────┐
        │  RDS MySQL Instance  │
        │  - todos database    │
        │  - todos table       │
        │  AWS Backup Snapshots│
        └──────────────────────┘
```

## 💾 Technologie

- **Backend**: Node.js + Express.js
- **Frontend**: HTML5 + vanilla JavaScript (ES6)
- **Database**: MySQL 8.0+ (via AWS RDS)
- **Driver**: mysql2 (async/await support)
- **Configuration**: Environment variables (.env)

## 📦 Installation Locale (ou sur EC2)

### Prérequis

- Node.js 16+ et npm
- Accès à une base de données MySQL (RDS AWS ou locale pour tests)

### 1. Cloner le repo et installer les dépendances

```bash
git clone https://github.com/your-org/disaster-recovery-lab.git
cd disaster-recovery-lab
npm install
```

### 2. Configurer les variables d'environnement

Copier le fichier `.env.example` vers `.env` :

```bash
cp .env.example .env
```

Éditer `.env` avec vos paramètres RDS :

```env
PORT=3000
DB_HOST=my-rds-instance.xxxxxxxxxxxx.us-east-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=MySecurePassword123!
DB_NAME=tododb
```

### 3. Créer la base de données et la table

**Sur l'instance RDS (via MySQL client) :**

```bash
mysql -h <RDS-ENDPOINT> -u admin -p
```

Puis exécuter le script `schema.sql` :

```bash
mysql -h <RDS-ENDPOINT> -u admin -p tododb < schema.sql
```

### 4. Démarrer l'application

```bash
npm start
```

L'application devrait être accessible à `http://localhost:3000`.

## 🌐 Endpoints

### Frontend
- **GET** `/` → Affiche la page HTML principale

### API REST

#### Récupérer toutes les tâches
```bash
GET /api/todos
```

**Réponse (200 OK):**
```json
{
  "error": false,
  "todos": [
    {
      "id": 1,
      "title": "Faire le lab AWS DR",
      "created_at": "2026-05-30T10:30:00.000Z"
    }
  ]
}
```

**Réponse (503 - DB indisponible):**
```json
{
  "error": true,
  "message": "Database connection unavailable",
  "todos": []
}
```

#### Ajouter une nouvelle tâche
```bash
POST /api/todos
Content-Type: application/json

{
  "title": "Ma nouvelle tâche"
}
```

**Réponse (200 OK):**
```json
{
  "error": false,
  "message": "Todo added successfully"
}
```

**Réponse (503 - DB indisponible):**
```json
{
  "error": true,
  "message": "Database connection unavailable"
}
```

#### Vérifier l'état de santé
```bash
GET /health
```

**Réponse:**
```json
{
  "status": "running",
  "database": "connected",
  "timestamp": "2026-05-30T10:30:00.000Z"
}
```

## 🛡️ Gestion des Erreurs et Robustesse

L'application est conçue pour **rester opérationnelle** même en cas de perte de connexion à la base de données :

- ✅ **Connexion échouée au démarrage** → L'app démarre quand même avec un message d'erreur
- ✅ **Perte de connexion pendant l'exécution** → Les endpoints retournent un message claire (HTTP 503)
- ✅ **Frontend responsif** → Affiche un bandeau d'alerte rouge : "⚠️ Connexion RDS échouée"
- ✅ **Auto-refresh** → La page cherche à se reconnecter automatiquement toutes les 2 secondes

## 📊 Scénario de Test - Disaster Recovery

### Étape 1: Créer des données
1. Ouvrir http://EC2-IP:3000
2. Ajouter plusieurs tâches (ex: "Task 1", "Task 2", etc.)
3. Vérifier que les tâches s'affichent immédiatement

### Étape 2: Configurer le Backup AWS
1. Aller à **AWS RDS Console** → **DB Instances**
2. Sélectionner votre instance MySQL
3. Cliquer sur **Backup and restore** ou utiliser **AWS Backup**
4. Créer un snapshot manuel de la base de données

### Étape 3: Simuler la perte de données
1. **Option A (plus prudente)** : Arrêter l'instance RDS
   - L'application affichera : "🔴 Database Disconnected"
   - Les tâches ne s'afficheront plus (mais le frontend reste fonctionnel)

2. **Option B (plus radical)** : Supprimer les données
   ```sql
   DELETE FROM todos;
   ```
   - Les tâches disparaîtront de l'application
   - Le frontend affichera une liste vide

### Étape 4: Restaurer depuis le snapshot
1. Aller à **AWS RDS** → **Snapshots**
2. Cliquer sur le snapshot créé précédemment
3. Cliquer sur **Restore from snapshot**
4. Configurer les mêmes paramètres (VPC, Security Group, etc.)
5. Attendre la restauration (~5-10 minutes)

### Étape 5: Vérifier la restauration
1. Une fois l'instance restaurée, mettre à jour `.env` avec le nouvel endpoint RDS (si change)
2. Relancer l'application (ou elle se reconnectera auto)
3. Vérifier que les tâches originelles sont présentes ! ✅

## 🐳 Déploiement sur une EC2 Ubuntu

### 1. Mise à jour du système

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm git
```

### 2. Cloner l'application

```bash
cd /opt
sudo git clone https://github.com/your-org/disaster-recovery-lab.git
cd disaster-recovery-lab
```

### 3. Installer les dépendances

```bash
npm install --production
```

### 4. Configurer `.env`

```bash
sudo nano .env
```

### 5. Configurer systemd (pour auto-start)

Créer `/etc/systemd/system/todo-app.service` :

```ini
[Unit]
Description=AWS DR Lab - Todo Application
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/disaster-recovery-lab
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
EnvironmentFile=/opt/disaster-recovery-lab/.env

[Install]
WantedBy=multi-user.target
```

Activer le service :

```bash
sudo systemctl daemon-reload
sudo systemctl enable todo-app
sudo systemctl start todo-app
sudo systemctl status todo-app
```

### 6. Configurer le Security Group AWS

Autoriser le trafic entrant :

```
Inbound Rules:
- Port 3000/TCP from anywhere (0.0.0.0/0) for HTTP access
- Port 22/TCP from your IP for SSH
```

Puis accéder à l'application via `http://<EC2-PUBLIC-IP>:3000`

## 📁 Structure du Projet

```
disaster-recovery-lab/
├── server.js                 # Serveur Express principal
├── package.json              # Dépendances Node.js
├── .env.example              # Exemple de variables d'environnement
├── .env                       # Variables d'environnement (local, .gitignored)
├── .gitignore                # Fichiers à ignorer
├── schema.sql                # Script d'initialisation MySQL
├── README.md                 # Cette documentation
└── public/
    └── index.html            # Page frontend unique
```

## 🔍 Troubleshooting

### Erreur: "ECONNREFUSED - Connection refused"

**Cause**: La base de données n'est pas accessible.

**Solutions**:
1. Vérifier que RDS est en état "available" dans AWS Console
2. Vérifier le Security Group RDS autorise les connexions depuis l'EC2
3. Vérifier les credentials dans `.env`
4. Vérifier que l'endpoint RDS est correct

### Erreur: "ER_ACCESS_DENIED_FOR_USER"

**Cause**: Mauvaises credentials.

**Solution**: Vérifier `DB_USER` et `DB_PASSWORD` dans `.env`

### La page affiche "Aucune tâche" mais je suis sûr d'en avoir ajouté

**Cause**: Peut-être que les tâches ont été supprimées ou la table n'existe pas.

**Solutions**:
1. Exécuter `schema.sql` pour recréer la table
2. Vérifier via MySQL : `SELECT * FROM todos;`

### Le frontend n'affiche pas le bandeau d'erreur

**Cause**: L'endpoint `/health` n'est peut-être pas accessible.

**Solution**: Tester manuellement :
```bash
curl http://localhost:3000/health
```

## 📚 Concepts Pédagogiques Couverts

- ✅ **Database Architecture** : Séparation app/données
- ✅ **Disaster Recovery Planning** : Snapshots, restauration
- ✅ **Business Continuity** : RTO/RPO (Recovery Time/Point Objectives)
- ✅ **AWS Services** : RDS, Snapshots, Security Groups
- ✅ **Resilience** : Gestion d'erreurs, graceful degradation
- ✅ **DevOps** : Configuration via env vars, systemd services
- ✅ **REST APIs** : Design minimaliste et idempotence

## 📝 Licence

MIT License - Libre d'utilisation pour des fins pédagogiques.

## ✋ Support

Pour des questions ou des améliorations, ouvrir une issue sur GitHub.

---

**Créé pour les étudiants en Cloud Architecture et DevOps** 🎓

Happy learning! 🚀
