// Script para detectar el puerto correcto de la impresora Zebra
const net = require('net');

const PRINTER_IP = '192.168.205.47';
const COMMON_PORTS = [
  { port: 9100, name: 'Puerto RAW estándar Zebra' },
  { port: 6101, name: 'Puerto alternativo Zebra' },
  { port: 9101, name: 'Puerto secundario' },
  { port: 515, name: 'Puerto LPD (Line Printer Daemon)' },
  { port: 80, name: 'Puerto HTTP (interfaz web)' },
  { port: 443, name: 'Puerto HTTPS' },
];

console.log('====================================');
console.log('DETECTOR DE PUERTOS ZEBRA');
console.log('====================================\n');
console.log('Escaneando impresora: ' + PRINTER_IP + '\n');

let testsCompleted = 0;
const results = [];

COMMON_PORTS.forEach(({ port, name }) => {
  const client = new net.Socket();
  
  client.setTimeout(2000);
  
  client.connect(port, PRINTER_IP, () => {
    results.push({ port, name, status: ' ABIERTO' });
    client.end();
  });
  
  client.on('timeout', () => {
    results.push({ port, name, status: ' Timeout' });
    client.destroy();
    checkComplete();
  });
  
  client.on('error', (err) => {
    results.push({ port, name, status: ' Cerrado' });
    checkComplete();
  });
  
  client.on('close', () => {
    checkComplete();
  });
});

function checkComplete() {
  testsCompleted++;
  
  if (testsCompleted === COMMON_PORTS.length) {
    console.log('Resultados del escaneo:\n');
    console.log('Puerto\tEstado\t\t\tDescripción');
    console.log('');
    
    results
      .sort((a, b) => a.port - b.port)
      .forEach(({ port, name, status }) => {
        const padding = status.length < 15 ? '\t\t' : '\t';
        console.log(port + '\t' + status + padding + name);
      });
    
    const openPorts = results.filter(r => r.status === ' ABIERTO');
    
    console.log('\n==================================================================');
    
    if (openPorts.length > 0) {
      console.log('\n PUERTOS ABIERTOS ENCONTRADOS:');
      openPorts.forEach(({ port, name }) => {
        console.log('    Puerto ' + port + ': ' + name);
      });
      
      const rawPort = openPorts.find(p => p.port === 9100 || p.port === 6101 || p.port === 9101);
      if (rawPort) {
        console.log('\n RECOMENDACIÓN: Usa el puerto ' + rawPort.port + ' para impresión RAW');
      }
      
      const webPort = openPorts.find(p => p.port === 80 || p.port === 443);
      if (webPort) {
        console.log('\n Puedes acceder a la interfaz web en: http://' + PRINTER_IP);
      }
    } else {
      console.log('\n NO SE ENCONTRARON PUERTOS ABIERTOS');
      console.log('\nPosibles causas:');
      console.log('  1. La impresora está en modo sleep/standby');
      console.log('  2. La impresora tiene firewall activado');
      console.log('  3. El protocolo RAW no está habilitado');
      console.log('  4. La red está bloqueando el acceso');
      console.log('\nSoluciones:');
      console.log('   Reinicia la impresora (apagar/encender)');
      console.log('   Imprime una etiqueta de configuración de red');
      console.log('   Accede a la interfaz web si el puerto 80 responde');
      console.log('   Verifica la configuración de red en el panel de la impresora');
    }
    
    console.log('\n====================================\n');
  }
}
