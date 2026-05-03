#!/usr/bin/env node

/**
 * Script de démarrage Node.js - Salon de Coiffure
 * Lance les services backend et frontend en parallèle
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;

console.log('\n');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║      🎨 SALON DE COIFFURE - Démarrage des Services       ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Vérifier que Docker est lancé
const checkDocker = () => {
  return new Promise((resolve) => {
    const docker = spawn('docker', ['ps'], { stdio: 'pipe' });
    docker.on('close', (code) => {
      resolve(code === 0);
    });
  });
};

// Vérifier que PostgreSQL est accessible
const checkPostgres = () => {
  return new Promise((resolve) => {
    const docker = spawn('docker', ['ps', '--filter', 'name=salon-postgres'], { stdio: 'pipe' });
    let output = '';
    docker.stdout.on('data', (data) => {
      output += data.toString();
    });
    docker.on('close', () => {
      resolve(output.includes('salon-postgres'));
    });
  });
};

// Lancer un processus
const launchService = (name, command, args, cwd) => {
  return new Promise((resolve, reject) => {
    console.log(`\n⏳ Lancement de ${name}...`);
    
    const service = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true
    });

    service.on('error', (err) => {
      console.error(`❌ Erreur ${name}:`, err);
      reject(err);
    });

    // Attendre un peu puis laisser le processus s'exécuter
    setTimeout(() => {
      resolve(service);
    }, 2000);
  });
};

// Fonction principale
const main = async () => {
  try {
    // Étape 1: Vérifier Docker
    console.log('📋 Vérification des prérequis...\n');
    const dockerReady = await checkDocker();
    if (!dockerReady) {
      throw new Error('Docker n\'est pas accessible. Assurez-vous que Docker Desktop est lancé.');
    }
    console.log('✅ Docker est accessible');

    // Étape 2: Démarrer PostgreSQL
    console.log('\n📦 Vérification de PostgreSQL...');
    const postgresRunning = await checkPostgres();
    
    if (!postgresRunning) {
      console.log('   PostgreSQL non trouvé. Lancement via docker-compose...');
      const compose = spawn('docker-compose', ['up', '-d', 'postgres'], {
        cwd: projectRoot,
        stdio: 'inherit'
      });
      
      await new Promise((resolve) => {
        compose.on('close', () => {
          console.log('✅ PostgreSQL en cours de démarrage...');
          setTimeout(resolve, 8000); // Attendre le démarrage
        });
      });
    } else {
      console.log('✅ PostgreSQL déjà actif');
    }

    // Étape 3: Configurer le backend
    console.log('\n🔧 Configuration du Backend...');
    const backendDir = path.join(projectRoot, 'backend');
    
    if (!fs.existsSync(path.join(backendDir, 'node_modules'))) {
      console.log('   Installation des dépendances...');
      const npmInstall = spawn('npm', ['install'], {
        cwd: backendDir,
        stdio: 'inherit'
      });
      
      await new Promise((resolve) => {
        npmInstall.on('close', () => {
          console.log('✅ Dépendances installées');
          resolve();
        });
      });
    }

    // Générer Prisma client
    console.log('   Génération du client Prisma...');
    const prismaGen = spawn('npm', ['run', 'db:generate'], {
      cwd: backendDir,
      stdio: 'pipe'
    });
    
    await new Promise((resolve) => {
      prismaGen.on('close', () => {
        console.log('✅ Client Prisma généré');
        resolve();
      });
    });

    // Synchroniser la base de données
    console.log('   Synchronisation de la base de données...');
    const dbPush = spawn('npm', ['run', 'db:push', '--', '--skip-generate'], {
      cwd: backendDir,
      stdio: 'pipe'
    });
    
    await new Promise((resolve) => {
      dbPush.on('close', () => {
        console.log('✅ Base de données synchronisée');
        resolve();
      });
    });

    // Étape 4: Configurer le frontend
    console.log('\n🎨 Configuration du Frontend...');
    const frontendDir = path.join(projectRoot, 'frontend');
    
    if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
      console.log('   Installation des dépendances...');
      const npmInstall = spawn('npm', ['install'], {
        cwd: frontendDir,
        stdio: 'inherit'
      });
      
      await new Promise((resolve) => {
        npmInstall.on('close', () => {
          console.log('✅ Dépendances installées');
          resolve();
        });
      });
    } else {
      console.log('✅ Dépendances déjà installées');
    }

    // Étape 5: Lancer les services
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              🚀 Lancement des Services...                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    // Lancer Backend
    const backend = spawn('npm', ['run', 'dev'], {
      cwd: backendDir,
      stdio: 'inherit'
    });

    // Lancer Frontend
    setTimeout(() => {
      const frontend = spawn('npm', ['run', 'dev'], {
        cwd: frontendDir,
        stdio: 'inherit'
      });
    }, 3000);

    // Afficher les infos
    setTimeout(() => {
      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║              ✅ SERVICES EN COURS D\'EXÉCUTION            ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('📍 ACCÈS À L\'APPLICATION:');
      console.log('');
      console.log('   🌐 Frontend:       http://localhost:3000');
      console.log('   🔌 API Backend:    http://localhost:3001');
      console.log('   ✅ Health Check:   http://localhost:3001/health');
      console.log('   📊 PrismaStudio:   npm run db:studio (dans backend/)');
      console.log('');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('');
    }, 5000);

    // Garder le processus actif
    process.on('SIGINT', () => {
      console.log('\n\n⛔ Arrêt des services...');
      backend.kill();
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error('\n📋 Troubleshooting:');
    console.error('   1. Assurez-vous que Docker Desktop est lancé');
    console.error('   2. Vérifiez que Node.js et npm sont installés');
    console.error('   3. Consultez STARTUP_GUIDE.md pour plus d\'aide');
    process.exit(1);
  }
};

main();
