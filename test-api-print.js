// Script para probar el endpoint de impresión en red
// Simula lo que haría una tablet al llamar al API

const SERVER_URL = 'http://localhost:9002'; // Cambia esto si es diferente

console.log('====================================');
console.log('PRUEBA DE API DE IMPRESIÓN EN RED');
console.log('====================================\n');

// Datos de prueba
const testData = {
  orden: 'TEST-001',
  paquete: '1',
  unidades: '10',
  descripcionMaterial: 'PRUEBA DESDE API',
  codigoBarras: 'TEST001-1',
  codigoEmpleado: '000'
};

console.log('1. Verificando estado de la impresora...');
console.log(`   URL: ${SERVER_URL}/api/zebra-network`);

fetch(`${SERVER_URL}/api/zebra-network`)
  .then(response => response.json())
  .then(data => {
    console.log('   Respuesta:', JSON.stringify(data, null, 2));
    
    if (data.available) {
      console.log('   ✓ Impresora disponible\n');
      console.log('2. Enviando etiqueta de prueba...');
      console.log('   Datos:', JSON.stringify(testData, null, 2));
      
      return fetch(`${SERVER_URL}/api/zebra-network`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });
    } else {
      throw new Error('Impresora no disponible: ' + data.error);
    }
  })
  .then(response => response.json())
  .then(data => {
    console.log('\n   Respuesta:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ ¡ÉXITO! Impresión enviada correctamente');
      console.log('   Orden:', data.orden);
      console.log('   Paquete:', data.paquete);
      console.log('   Unidades:', data.unidades);
      console.log('   Impresora:', data.printer);
      console.log('\nLa etiqueta debería estar imprimiendo ahora...');
    } else {
      console.error('\n❌ ERROR:', data.error);
    }
    
    console.log('\n====================================\n');
  })
  .catch(error => {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nVerifica:');
    console.error('  1. El servidor Next.js está corriendo: npm run dev');
    console.error('  2. El servidor está en el puerto correcto (9002)');
    console.error('  3. La impresora está encendida y accesible');
    console.error('  4. La URL del servidor es correcta:', SERVER_URL);
    console.error('\n====================================\n');
  });
