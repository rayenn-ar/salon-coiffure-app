#!/bin/bash

# Script de démarrage pour le projet Salon de Coiffure

echo "🚀 Démarrage du projet Salon de Coiffure..."
echo ""

# Changement vers le répertoire du projet
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

# Étape 1: Démarrage de PostgreSQL
echo "📦 Démarrage de PostgreSQL via Docker..."
docker-compose up -d postgres

# Attendre que PostgreSQL soit prêt
echo "⏳ Attente du démarrage de PostgreSQL..."
sleep 10

# Étape 2: Installation des dépendances du backend
echo ""
echo "📚 Installation des dépendances du backend..."
cd backend
npm install

# Étape 3: Génération du client Prisma
echo "🔧 Génération du client Prisma..."
npm run db:generate

# Étape 4: Migration de la base de données
echo "🗄️ Exécution des migrations Prisma..."
npm run db:push

# Étape 5: Seed de la base de données (si applicable)
echo "🌱 Seed de la base de données..."
npm run db:seed 2>/dev/null || echo "⚠️ Pas de seed à exécuter"

# Démarrage du backend en arrière-plan
echo ""
echo "🚀 Démarrage du backend sur http://localhost:3001..."
npm run dev &
BACKEND_PID=$!

# Étape 6: Installation des dépendances du frontend
echo ""
echo "📚 Installation des dépendances du frontend..."
cd ../frontend
npm install

# Démarrage du frontend
echo ""
echo "🚀 Démarrage du frontend sur http://localhost:3000..."
npm run dev &
FRONTEND_PID=$!

# Affichage des URLs
echo ""
echo "====================================="
echo "✅ Application lancée avec succès!"
echo "====================================="
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 API Backend: http://localhost:3001"
echo "💾 Database: postgresql://postgres:postgres@localhost:5434/salon_db"
echo ""
echo "Ctrl+C pour arrêter les services"
echo ""

# Attendre que les processus se terminent
wait $BACKEND_PID $FRONTEND_PID
