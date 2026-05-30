# 🚀 Guide de Déploiement AWS pour le Lab Disaster Recovery

## Step-by-Step: Créer l'infrastructure AWS

### 1️⃣ Créer une VPC et Security Groups

#### Security Group pour RDS
```bash
aws ec2 create-security-group \
  --group-name dr-lab-rds-sg \
  --description "RDS Security Group for DR Lab" \
  --vpc-id vpc-xxxxx
```

Ajouter une règle pour accepter les connexions MySQL depuis l'EC2 :
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 3306 \
  --source-security-group-id sg-ec2-xxxxx
```

#### Security Group pour EC2
```bash
aws ec2 create-security-group \
  --group-name dr-lab-ec2-sg \
  --description "EC2 Security Group for DR Lab" \
  --vpc-id vpc-xxxxx
```

Ajouter des règles :
```bash
# SSH
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

# HTTP (port 3000)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0
```

### 2️⃣ Créer l'instance RDS MySQL

```bash
aws rds create-db-instance \
  --db-instance-identifier dr-lab-mysql \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --engine-version 8.0.35 \
  --master-username admin \
  --master-user-password MySecurePassword123! \
  --allocated-storage 20 \
  --storage-type gp2 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name default \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --publicly-accessible false \
  --no-enable-iam-database-authentication
```

Attendre que l'instance soit en état "available" (~5-10 minutes).

Récupérer l'endpoint :
```bash
aws rds describe-db-instances \
  --db-instance-identifier dr-lab-mysql \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

### 3️⃣ Créer une Base de Données et Table

Connexion à RDS :
```bash
mysql -h <RDS-ENDPOINT> -u admin -p
```

Exécuter :
```sql
CREATE DATABASE tododb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tododb;

-- Exécuter le contenu de schema.sql
CREATE TABLE todos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_created_at ON todos(created_at);
```

### 4️⃣ Lancer une instance EC2

```bash
# Récupérer une AMI Ubuntu LTS
AWS_AMI=$(aws ec2 describe-images \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

# Créer l'instance
aws ec2 run-instances \
  --image-id $AWS_AMI \
  --instance-type t3.micro \
  --key-name my-keypair \
  --security-group-ids sg-xxxxx \
  --subnet-id subnet-xxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=dr-lab-app}]'
```

Récupérer l'IP publique :
```bash
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=dr-lab-app" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

### 5️⃣ Déployer l'Application sur EC2

SSH dans l'instance :
```bash
ssh -i my-keypair.pem ubuntu@<EC2-PUBLIC-IP>
```

Installer Node.js et cloner le repo :
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm git mysql-client

cd /opt
sudo git clone https://github.com/your-org/disaster-recovery-lab.git
cd disaster-recovery-lab

npm install --production
```

Créer le fichier `.env` :
```bash
sudo tee .env > /dev/null <<EOF
PORT=3000
DB_HOST=dr-lab-mysql.xxxxxxxxxx.us-east-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=MySecurePassword123!
DB_NAME=tododb
EOF
```

Initialiser la base de données :
```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < schema.sql
```

Démarrer l'application avec systemd (voir README.md pour la config) :
```bash
sudo systemctl start todo-app
sudo systemctl status todo-app
```

### 6️⃣ Tester l'Application

Ouvrir le navigateur :
```
http://<EC2-PUBLIC-IP>:3000
```

Vérifier que :
- ✅ La page charge correctement
- ✅ Le badge affiche "🟢 Database Connected"
- ✅ On peut ajouter une tâche
- ✅ Les tâches s'affichent immédiatement

### 7️⃣ Configurer AWS Backup

#### Option A : Snapshot manuel

```bash
aws rds create-db-snapshot \
  --db-instance-identifier dr-lab-mysql \
  --db-snapshot-identifier dr-lab-snapshot-$(date +%s)
```

Vérifier le snapshot :
```bash
aws rds describe-db-snapshots \
  --db-snapshot-identifier <SNAPSHOT-ID> \
  --query 'DBSnapshots[0].Status' \
  --output text
```

#### Option B : Backup automatique avec AWS Backup

```bash
aws backup create-backup-plan \
  --backup-plan '{
    "BackupPlanName": "dr-lab-backup",
    "Rules": [{
      "RuleName": "DailyBackup",
      "TargetBackupVault": "Default",
      "ScheduleExpression": "cron(0 5 ? * * *)",
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 120,
      "Lifecycle": {
        "DeleteAfterDays": 30
      }
    }]
  }'
```

### 8️⃣ Simuler un Disaster et Restaurer

#### Étape 1: Ajouter des données
Utiliser l'app web pour ajouter plusieurs tâches.

#### Étape 2: Simuler la perte

**Option A : Arrêter RDS**
```bash
aws rds stop-db-instance --db-instance-identifier dr-lab-mysql
```

L'app affichera : "🔴 Database Disconnected"

**Option B : Supprimer les données**
```bash
mysql -h <RDS-ENDPOINT> -u admin -p
> DELETE FROM tododb.todos;
> FLUSH PRIVILEGES;
```

#### Étape 3: Restaurer depuis le snapshot

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier dr-lab-mysql-restored \
  --db-snapshot-identifier <SNAPSHOT-ID>
```

Attendre que l'instance soit "available" (~5-10 minutes).

#### Étape 4: Mettre à jour l'endpoint

Récupérer le nouvel endpoint :
```bash
aws rds describe-db-instances \
  --db-instance-identifier dr-lab-mysql-restored \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

Mettre à jour `.env` sur l'EC2 et relancer l'app :
```bash
ssh -i my-keypair.pem ubuntu@<EC2-PUBLIC-IP>
sudo nano /opt/disaster-recovery-lab/.env
# Éditer DB_HOST avec le nouvel endpoint

sudo systemctl restart todo-app
```

#### Étape 5: Vérifier la restauration

Recharger http://<EC2-PUBLIC-IP>:3000 et vérifier que les tâches originales sont là ! ✅

## 📊 Métriques Pédagogiques à Calculer

Pour montrer le concept de RTO (Recovery Time Objective) et RPO (Recovery Point Objective) :

- **RPO** : Combien de données avez-vous perdu ? (0 si snapshot récent)
- **RTO** : Combien de temps a pris la restauration ? (généralement 5-15 minutes pour RDS)

### Calculer et afficher dans le lab :

```bash
# Temps de démarrage du snapshot
TIME_START=$(date +%s)
aws rds restore-db-instance-from-db-snapshot ...
# Attendre...
TIME_END=$(date +%s)
echo "RTO: $((TIME_END - TIME_START)) seconds"
```

## 🧹 Nettoyage

Supprimer l'infrastructure pour éviter les frais AWS :

```bash
# Arrêter l'EC2
aws ec2 terminate-instances --instance-ids <INSTANCE-ID>

# Supprimer l'instance RDS (avec snapshot final)
aws ec2 delete-security-group --group-id sg-xxxxx

# Supprimer les snapshots
aws rds delete-db-snapshot --db-snapshot-identifier <SNAPSHOT-ID>

# Supprimer les instances RDS
aws rds delete-db-instance \
  --db-instance-identifier dr-lab-mysql \
  --skip-final-snapshot
```

## 💡 Tips & Tricks

1. **Utilisez AWS CloudFormation** pour automatiser tout cela :
   ```yaml
   AWSTemplateFormatVersion: '2010-09-09'
   Resources:
     TodoDBInstance:
       Type: AWS::RDS::DBInstance
       Properties:
         DBInstanceIdentifier: dr-lab-mysql
         Engine: MySQL
         # ... (voir la doc AWS)
   ```

2. **Monitoring avec CloudWatch** :
   ```bash
   aws cloudwatch put-metric-alarm \
     --alarm-name dr-lab-rds-cpu \
     --metric-name CPUUtilization \
     --dimensions Name=DBInstanceIdentifier,Value=dr-lab-mysql \
     --threshold 80
   ```

3. **Logs avec CloudWatch** :
   Les logs MySQL de RDS peuvent être consultés directement dans l'AWS Console.

---

**Bon lab! 🎓**
