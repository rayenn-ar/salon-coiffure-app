const http = require('http');

console.log('🔍 Test de connexion à l\'API backend...\n');

// Test 1: Health check
const options1 = {
  hostname: 'localhost',
  port: 3001,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const req1 = http.request(options1, (res) => {
  console.log('✅ Health check: Status', res.statusCode);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('   Réponse:', data);
    console.log('');
    
    // Test 2: API Services
    const options2 = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/services',
      method: 'GET',
      timeout: 5000
    };
    
    const req2 = http.request(options2, (res2) => {
      console.log('✅ API Services: Status', res2.statusCode);
      let data2 = '';
      res2.on('data', (chunk) => data2 += chunk);
      res2.on('end', () => {
        try {
          const json = JSON.parse(data2);
          console.log('   Services:', json.length || 'N/A');
        } catch (e) {
          console.log('   Réponse:', data2.substring(0, 200));
        }
      });
    });
    
    req2.on('error', (e) => {
      console.log('❌ Erreur API Services:', e.message);
    });
    
    req2.on('timeout', () => {
      console.log('⏱️  Timeout API Services');
      req2.destroy();
    });
    
    req2.end();
  });
});

req1.on('error', (e) => {
  console.log('❌ Erreur Health check:', e.message);
  console.log('\n⚠️  Le backend ne semble pas accessible sur http://localhost:3001');
  console.log('   Vérifiez que le serveur est bien démarré.');
});

req1.on('timeout', () => {
  console.log('⏱️  Timeout Health check - le serveur ne répond pas');
  req1.destroy();
});

req1.end();
