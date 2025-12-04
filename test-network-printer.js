// Script de prueba para impresión directa en impresora de red Zebra
// IP: 192.168.205.47 | Puerto: 9100 (estándar Zebra)
const net = require('net');

// Configuración de la impresora
const PRINTER_IP = '192.168.205.47';
const PRINTER_PORT = 9100;

// ZPL de prueba
const zplCode = `^XA
^FO50,50^A0N,50,50^FD** PRUEBA IMPRESORA RED **^FS
^FO50,120^ADN,36,20^FDFecha: ${new Date().toLocaleDateString('es-EC')}^FS
^FO50,160^ADN,36,20^FDHora: ${new Date().toLocaleTimeString('es-EC')}^FS
^FO50,200^ADN,30,15^FDIP: ${PRINTER_IP}:${PRINTER_PORT}^FS
^FO50,250^BY3^BCN,100,Y,N,N^FD123456789^FS
^FO50,370^A0N,25,25^FDTest desde Node.js^FS
^XZ`;

console.log('====================================');
console.log('PRUEBA DE IMPRESIÓN EN RED - ZEBRA');
console.log('====================================\n');
console.log(`Impresora: ${PRINTER_IP}:${PRINTER_PORT}`);
console.log(`Tamaño ZPL: ${zplCode.length} bytes`);
console.log('\nConectando...\n');

// Crear conexión TCP
const client = new net.Socket();

// Configurar timeout
client.setTimeout(5000);

// Evento: Conexión exitosa
client.connect(PRINTER_PORT, PRINTER_IP, () => {
  console.log('✓ Conexión establecida con la impresora');
  console.log('✓ Enviando datos ZPL...');
  
  // Enviar el código ZPL
  client.write(zplCode, () => {
    console.log('✓ Datos ZPL enviados exitosamente');
    console.log('\n✅ IMPRESIÓN COMPLETADA');
    console.log('La etiqueta debería estar imprimiendo ahora...\n');
  });
});

// Evento: Datos recibidos de la impresora
client.on('data', (data) => {
  console.log('📥 Respuesta de la impresora:');
  console.log(data.toString());
});

// Evento: Timeout
client.on('timeout', () => {
  console.error('\n❌ ERROR: Timeout');
  console.error('La impresora no respondió en 5 segundos\n');
  console.error('Verifica:');
  console.error('  - La impresora está encendida');
  console.error('  - La IP es correcta:', PRINTER_IP);
  console.error('  - La impresora está en la misma red');
  console.error('  - Prueba: ping', PRINTER_IP);
  client.destroy();
  process.exit(1);
});

// Evento: Error de conexión
client.on('error', (err) => {
  console.error('\n❌ ERROR DE CONEXIÓN:', err.message);
  console.error('\nCódigo de error:', err.code);
  
  switch(err.code) {
    case 'ETIMEDOUT':
      console.error('\nDiagnóstico: Timeout de conexión');
      console.error('  - La impresora no responde');
      console.error('  - Verifica que esté encendida');
      console.error('  - Prueba: ping', PRINTER_IP);
      break;
      
    case 'ECONNREFUSED':
      console.error('\nDiagnóstico: Conexión rechazada');
      console.error('  - El puerto', PRINTER_PORT, 'está cerrado o bloqueado');
      console.error('  - Verifica que la impresora acepte conexiones de red');
      console.error('  - Verifica el firewall');
      break;
      
    case 'ENETUNREACH':
      console.error('\nDiagnóstico: Red no alcanzable');
      console.error('  - Verifica que estés en la misma red que la impresora');
      console.error('  - Verifica la configuración de red');
      break;
      
    case 'EHOSTUNREACH':
      console.error('\nDiagnóstico: Host no alcanzable');
      console.error('  - La IP', PRINTER_IP, 'no responde');
      console.error('  - Verifica la dirección IP de la impresora');
      break;
      
    default:
      console.error('\nDiagnóstico: Error desconocido');
      console.error('  - Revisa los logs anteriores para más detalles');
  }
  
  console.error('\n');
  process.exit(1);
});

// Evento: Conexión cerrada
client.on('close', () => {
  console.log('Conexión cerrada');
  console.log('====================================\n');
  process.exit(0);
});

// Cerrar la conexión después de 2 segundos
setTimeout(() => {
  if (client.readyState !== 'closed') {
    console.log('\nCerrando conexión...');
    client.end();
  }
}, 2000);

// Manejar Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrumpido por el usuario');
  client.destroy();
  process.exit(0);
});
