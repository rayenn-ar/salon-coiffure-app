import prisma from '../src/config/database';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Début du seeding...');

  // 1. Créer l'admin
  const adminPassword = await bcrypt.hash('admin12345', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@salon-beaute.fr' },
    update: { emailVerified: true, emailVerifiedAt: new Date() },
    create: {
      email: 'admin@salon-beaute.fr',
      password: adminPassword,
      role: 'ADMIN',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      admin: {
        create: { nom: 'Direction', prenom: 'Salon' },
      },
    },
  });
  console.log('✅ Admin créé:', admin.email);

  // 2. Créer des coiffeuses
  const coiffeusePassword = await bcrypt.hash('coiffeuse123', 12);

  const coiffeuses = [
    { email: 'fatima@salon-beaute.fr', nom: 'Benali', prenom: 'Fatima', bio: 'Spécialiste coloration et balayage, 8 ans d\'expérience', specialites: ['coloration', 'balayage', 'meches'], niveau: 'EXPERTE' },
    { email: 'sarah@salon-beaute.fr', nom: 'Dupont', prenom: 'Sarah', bio: 'Experte en coiffure événementielle et mariage', specialites: ['mariage', 'coiffage', 'chignon'], niveau: 'EXPERTE' },
    { email: 'amina@salon-beaute.fr', nom: 'Kone', prenom: 'Amina', bio: 'Spécialiste cheveux texturés et lissage', specialites: ['lissage', 'soin', 'coupe'], niveau: 'CONFIRMEE' },
    { email: 'marie@salon-beaute.fr', nom: 'Laurent', prenom: 'Marie', bio: 'Polyvalente, passionnée de coupes tendances', specialites: ['coupe', 'brushing', 'coloration'], niveau: 'CONFIRMEE' },
  ];

  for (const c of coiffeuses) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: { emailVerified: true, emailVerifiedAt: new Date() },
      create: {
        email: c.email,
        password: coiffeusePassword,
        role: 'COIFFEUSE',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        coiffeuse: {
          create: {
            nom: c.nom,
            prenom: c.prenom,
            bio: c.bio,
            specialites: c.specialites,
            niveau: c.niveau,
          },
        },
      },
      include: { coiffeuse: true },
    });

    // Ajouter des disponibilités (Lundi à Samedi)
    if (user.coiffeuse) {
      for (let jour = 1; jour <= 6; jour++) {
        await prisma.disponibilite.upsert({
          where: {
            coiffeuseId_jourSemaine: {
              coiffeuseId: user.coiffeuse.id,
              jourSemaine: jour,
            },
          },
          update: {},
          create: {
            coiffeuseId: user.coiffeuse.id,
            jourSemaine: jour,
            heureDebut: jour === 6 ? '09:00' : '09:00',
            heureFin: jour === 6 ? '17:00' : '19:00',
          },
        });
      }
    }

    console.log(`✅ Coiffeuse créée: ${c.prenom} ${c.nom}`);
  }

  // 3. Créer les services
  const servicesData = [
    // COUPES
    { nom: 'Coupe femme', categorie: 'COUPE' as const, description: 'Coupe personnalisée (carré, dégradé, effilé...)', prixBase: 35, dureeMinutes: 45, specialitesRequises: ['coupe'] },
    { nom: 'Coupe + Brushing', categorie: 'COUPE' as const, description: 'Coupe suivie d\'un brushing soigné', prixBase: 55, dureeMinutes: 75, specialitesRequises: ['coupe', 'brushing'] },
    { nom: 'Brushing', categorie: 'COUPE' as const, description: 'Brushing lisse, bouclé ou wavy', prixBase: 25, dureeMinutes: 40, specialitesRequises: ['brushing'] },
    // COLORATIONS
    { nom: 'Coloration complète', categorie: 'COLORATION' as const, description: 'Coloration racines aux pointes', prixBase: 65, dureeMinutes: 120, specialitesRequises: ['coloration'] },
    { nom: 'Balayage', categorie: 'COLORATION' as const, description: 'Balayage naturel et lumineux', prixBase: 85, dureeMinutes: 150, specialitesRequises: ['balayage', 'coloration'] },
    { nom: 'Mèches', categorie: 'COLORATION' as const, description: 'Mèches classiques ou modernes', prixBase: 75, dureeMinutes: 120, specialitesRequises: ['meches', 'coloration'] },
    { nom: 'Ombré / Tie & Dye', categorie: 'COLORATION' as const, description: 'Dégradé de couleur tendance', prixBase: 95, dureeMinutes: 180, specialitesRequises: ['coloration'] },
    { nom: 'Coloration végétale', categorie: 'COLORATION' as const, description: 'Coloration naturelle sans ammoniaque', prixBase: 80, dureeMinutes: 150, specialitesRequises: ['coloration'] },
    // SOINS
    { nom: 'Soin kératine', categorie: 'SOIN' as const, description: 'Lissage et réparation à la kératine', prixBase: 120, dureeMinutes: 120, specialitesRequises: ['soin', 'lissage'] },
    { nom: 'Botox capillaire', categorie: 'SOIN' as const, description: 'Soin profond hydratant et restructurant', prixBase: 90, dureeMinutes: 90, specialitesRequises: ['soin'] },
    { nom: 'Soin profond réparateur', categorie: 'SOIN' as const, description: 'Pour cheveux abîmés, secs ou cassants', prixBase: 45, dureeMinutes: 60, specialitesRequises: ['soin'] },
    { nom: 'Diagnostic cuir chevelu', categorie: 'SOIN' as const, description: 'Analyse et traitement personnalisé', prixBase: 30, dureeMinutes: 30, specialitesRequises: ['soin'] },
    // COIFFAGE ÉVÉNEMENT
    { nom: 'Coiffure mariage', categorie: 'COIFFAGE_EVENEMENT' as const, description: 'Coiffure jour J (chignon, tresses, accessoires)', prixBase: 150, dureeMinutes: 120, specialitesRequises: ['mariage', 'coiffage'] },
    { nom: 'Essai coiffure mariage', categorie: 'COIFFAGE_EVENEMENT' as const, description: 'Essai avant le jour J', prixBase: 80, dureeMinutes: 90, specialitesRequises: ['mariage', 'coiffage'] },
    { nom: 'Coiffure soirée / gala', categorie: 'COIFFAGE_EVENEMENT' as const, description: 'Coiffure élégante pour événement', prixBase: 70, dureeMinutes: 60, specialitesRequises: ['coiffage'] },
    // LISSAGE
    { nom: 'Lissage brésilien', categorie: 'SOIN' as const, description: 'Lissage longue durée', prixBase: 200, dureeMinutes: 240, specialitesRequises: ['lissage'] },
    // FORFAITS
    { nom: 'Forfait Mariée (essai + jour J)', categorie: 'FORFAIT' as const, description: 'Pack complet mariage', prixBase: 210, dureeMinutes: 210, specialitesRequises: ['mariage'] },
    { nom: 'Forfait Transformation', categorie: 'FORFAIT' as const, description: 'Coupe + Coloration + Soin', prixBase: 140, dureeMinutes: 180, specialitesRequises: ['coupe', 'coloration', 'soin'] },
  ];

  for (const s of servicesData) {
    const serviceId = s.nom.toLowerCase().replace(/[^a-z0-9]/g, '-');
    await prisma.service.upsert({
      where: { id: serviceId },
      update: {},
      create: { ...s, id: serviceId },
    });
  }
  console.log(`✅ ${servicesData.length} services créés`);

  // 4. Créer une cliente de test
  const clientePassword = await bcrypt.hash('cliente123', 12);
  await prisma.user.upsert({
    where: { email: 'test@cliente.fr' },
    update: { emailVerified: true, emailVerifiedAt: new Date() },
    create: {
      email: 'test@cliente.fr',
      password: clientePassword,
      role: 'CLIENTE',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      cliente: {
        create: {
          nom: 'Martin',
          prenom: 'Sophie',
          telephone: '0612345678',
          typeCheveux: 'boucles',
          textureCheveux: 'naturels',
        },
      },
    },
  });
  console.log('✅ Cliente test créée: test@cliente.fr');

  // 5. Créer des produits
  const produitsData = [
    { nom: 'Coloration L\'Oréal Majirel', reference: 'LOR-MAJ-001', categorie: 'coloration', fournisseur: 'L\'Oréal Pro', quantiteStock: 30, quantiteAlerte: 5, unite: 'tube', prixAchatUnite: 8.50 },
    { nom: 'Oxydant 20 Vol', reference: 'OXY-20V-001', categorie: 'coloration', fournisseur: 'L\'Oréal Pro', quantiteStock: 15, quantiteAlerte: 3, unite: 'litre', prixAchatUnite: 12.00 },
    { nom: 'Shampooing Expert Silver', reference: 'SH-SILV-001', categorie: 'shampooing', fournisseur: 'L\'Oréal Pro', quantiteStock: 20, quantiteAlerte: 5, unite: 'unite', prixAchatUnite: 15.00 },
    { nom: 'Masque Kératine', reference: 'MSK-KER-001', categorie: 'soin', fournisseur: 'Kérastase', quantiteStock: 12, quantiteAlerte: 3, unite: 'unite', prixAchatUnite: 28.00 },
    { nom: 'Sérum réparateur', reference: 'SER-REP-001', categorie: 'soin', fournisseur: 'Kérastase', quantiteStock: 8, quantiteAlerte: 2, unite: 'unite', prixAchatUnite: 22.00 },
    { nom: 'Laque fixation forte', reference: 'LAQ-FIX-001', categorie: 'coiffage', fournisseur: 'Schwarzkopf', quantiteStock: 10, quantiteAlerte: 3, unite: 'unite', prixAchatUnite: 9.00 },
  ];

  for (const p of produitsData) {
    await prisma.produit.upsert({
      where: { reference: p.reference },
      update: {},
      create: p,
    });
  }
  console.log(`✅ ${produitsData.length} produits créés`);

  console.log('\n🎉 Seeding terminé !');
  console.log('─────────────────────────────────────────');
  console.log('Comptes de test :');
  console.log('  Admin     : admin@salon-beaute.fr / admin12345');
  console.log('  Coiffeuse : fatima@salon-beaute.fr / coiffeuse123');
  console.log('  Cliente   : test@cliente.fr / cliente123');
  console.log('─────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
