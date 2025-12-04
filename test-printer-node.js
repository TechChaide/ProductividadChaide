// Script de diagnóstico para probar impresión desde Node.js
const fs = require('fs');
const os = require('os');
const net = require('net');

console.log('=== DIAGNÓSTICO DE IMPRESIÓN ===\n');

// 1. Información del sistema
console.log('1. INFORMACIÓN DEL SISTEMA:');
console.log('   - Usuario actual:', os.userInfo().username);
console.log('   - Plataforma:', os.platform());
console.log('   - Hostname:', os.hostname());
console.log('');

// 2. ZPL de prueba
const zplCode = `^XA
^FO50,50^A0N,45,45^FDTest desde Node.js^FS
^FO50,110^ADN,36,20^FD${new Date().toLocaleTimeString()}^FS
^FO50,160^ADN,36,20^FDHola Mundo desde Node :)))^FS
^FO80,220^BY3^BCN,100,Y,N,N^FD123456789^FS
^XZ`;

console.log('2. ZPL GENERADO:');
console.log('   Longitud:', zplCode.length, 'caracteres');
console.log('');

// 2.5. Función para imprimir directamente a impresora de red por IP
function printToNetworkPrinter(printerIP, printerPort, zplData) {
  return new Promise((resolve, reject) => {
    console.log(`   Conectando a impresora de red: ${printerIP}:${printerPort}...`);
    
    const client = new net.Socket();
    let hasError = false;
    
    // Timeout de conexión
    client.setTimeout(5000);
    
    client.connect(printerPort, printerIP, () => {
      console.log('   ✓ Conexión establecida');
      console.log('   Enviando datos ZPL...');
      client.write(zplData, () => {
        console.log('   ✓ Datos enviados exitosamente');
      });
    });
    
    client.on('data', (data) => {
      console.log('   Respuesta de impresora:', data.toString());
    });
    
    client.on('timeout', () => {
      hasError = true;
      client.destroy();
      reject(new Error('Timeout: No se pudo conectar a la impresora en 5 segundos'));
    });
    
    client.on('error', (err) => {
      hasError = true;
      reject(err);
    });
    
    client.on('close', () => {
      if (!hasError) {
        console.log('   ✓ Conexión cerrada correctamente');
        resolve(true);
      }
    });
    
    // Cerrar la conexión después de 2 segundos
    setTimeout(() => {
      if (!hasError) {
        client.end();
      }
    }, 2000);
  });
}

console.log('2.5. PRUEBA DE IMPRESIÓN EN RED (192.168.205.47):');
const PRINTER_IP = '192.168.205.47';
const PRINTER_PORT = 9100; // Puerto estándar para impresoras Zebra

printToNetworkPrinter(PRINTER_IP, PRINTER_PORT, zplCode)
  .then(() => {
    console.log('   ✓ ¡ÉXITO! Impresión enviada a la impresora de red');
    console.log('');
  })
  .catch((error) => {
    console.error('   ✗ ERROR con impresora de red:', error.message);
    console.log('');
    console.log('   DIAGNÓSTICO:');
    if (error.code === 'ETIMEDOUT' || error.message.includes('Timeout')) {
      console.log('   - La impresora no responde. Verifica que esté encendida');
      console.log('   - Verifica la dirección IP: ping 192.168.205.47');
      console.log('   - Verifica que el puerto 9100 esté abierto');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   - La conexión fue rechazada');
      console.log('   - Verifica que el puerto 9100 esté habilitado en la impresora');
    } else if (error.code === 'ENETUNREACH') {
      console.log('   - Red no alcanzable');
      console.log('   - Verifica que estés en la misma red que la impresora');
    }
    console.log('');
    
    // Continuar con las otras pruebas
    continuarConPruebaCompartida();
  });

function continuarConPruebaCompartida() {

}

// 3. Intentar escribir a la impresora
const printerPath = '\\\\UIOANALISTI4\\Zebra';

console.log('3. INTENTANDO IMPRIMIR (MÉTODO COMPARTIDO):');
console.log('   Ruta:', printerPath);

try {
  console.log('   Método 1: writeFileSync con buffer (como Python)...');
  const buffer = Buffer.from(zplCode, 'utf8');
  fs.writeFileSync(printerPath, buffer);
  console.log('   ✓ ¡ÉXITO! La etiqueta debería estar imprimiendo.');
} catch (error) {
  console.error('   ✗ ERROR:', error.message);
  console.error('   Código:', error.code);
  console.error('');
  
  // Información adicional según el tipo de error
  if (error.code === 'ENOENT') {
    console.log('   DIAGNÓSTICO: No se encontró la ruta de la impresora.');
    console.log('   SOLUCIONES:');
    console.log('   - Verifica que la impresora esté compartida en Windows');
    console.log('   - Verifica el nombre exacto del recurso compartido');
    console.log('   - Intenta acceder manualmente: \\\\UIOANALISTI4\\Zebra desde el Explorador');
  } else if (error.code === 'EACCES' || error.code === 'EPERM') {
    console.log('   DIAGNÓSTICO: Permisos insuficientes.');
    console.log('   SOLUCIONES:');
    console.log('   - Ejecuta este script como Administrador');
    console.log('   - Verifica los permisos de la carpeta compartida');
    console.log('   - Asegúrate de que el usuario actual tenga acceso de escritura');
  } else if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
    console.log('   DIAGNÓSTICO: Problemas de red.');
    console.log('   SOLUCIONES:');
    console.log('   - Verifica que el equipo UIOANALISTI4 esté en la misma red');
    console.log('   - Prueba hacer ping: ping UIOANALISTI4');
    console.log('   - Verifica el firewall');
  }
  
  console.log('');
  console.log('4. INTENTANDO ALTERNATIVAS:');
  
  // Alternativa: Crear archivo temporal y usar copy
  try {
    const tmpFile = `${os.tmpdir()}\\test_zebra_${Date.now()}.zpl`;
    console.log('   Método 2: Archivo temporal + comando copy...');
    console.log('   Archivo temporal:', tmpFile);
    
    fs.writeFileSync(tmpFile, zplCode, 'utf8');
    console.log('   ✓ Archivo temporal creado');
    
    const { execSync } = require('child_process');
    const command = `copy /B "${tmpFile}" "${printerPath}"`;
    console.log('   Comando:', command);
    
    const output = execSync(command, { encoding: 'utf8' });
    console.log('   ✓ Comando ejecutado:', output);
    
    fs.unlinkSync(tmpFile);
    console.log('   ✓ Archivo temporal eliminado');
    console.log('   ✓ ¡ÉXITO CON MÉTODO ALTERNATIVO!');
    
  } catch (altError) {
    console.error('   ✗ Error con método alternativo:', altError.message);
  }
}

console.log('');
console.log('=== FIN DEL DIAGNÓSTICO ===');
