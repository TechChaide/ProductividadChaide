/**
 * Proxy para BrowserPrint
 * Permite acceso remoto a BrowserPrint que solo escucha en localhost
 * 
 * Uso:
 *   node browserprint-proxy.js
 * 
 * El proxy escuchará en 0.0.0.0:9100 (todas las interfaces)
 * y reenviará las peticiones a localhost:9100 (BrowserPrint)
 */

const http = require('http');
const httpProxy = require('http-proxy');

// Puerto donde escuchará el proxy (mismo que BrowserPrint pero en todas las interfaces)
const PROXY_PORT = 9101; // Usamos 9101 para no conflictuar con BrowserPrint
const BROWSERPRINT_PORT = 9100;

// Crear el proxy
const proxy = httpProxy.createProxyServer({
  target: `http://localhost:${BROWSERPRINT_PORT}`,
  changeOrigin: true,
  ws: true, // Soporta WebSockets si es necesario
});

// Manejar errores del proxy
proxy.on('error', (err, req, res) => {
  console.error('❌ Error en proxy:', err.message);
  if (res.writeHead) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error en el proxy: ' + err.message);
  }
});

// Crear servidor HTTP que use el proxy
const server = http.createServer((req, res) => {
  console.log(`📥 ${req.method} ${req.url} desde ${req.socket.remoteAddress}`);
  
  // Agregar headers CORS para permitir acceso desde cualquier origen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Manejar OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Reenviar la petición a BrowserPrint
  proxy.web(req, res);
});

// Escuchar en todas las interfaces (0.0.0.0)
server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  🖨️  Proxy BrowserPrint Iniciado                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Escuchando en: 0.0.0.0:${PROXY_PORT}`);
  console.log(`🔄 Reenviando a: localhost:${BROWSERPRINT_PORT}`);
  console.log('');
  console.log('📋 Accede desde:');
  console.log(`   • PC Local:  http://localhost:${PROXY_PORT}`);
  console.log(`   • Tablet:    http://192.168.205.95:${PROXY_PORT}`);
  console.log('');
  console.log('⚠️  Asegúrate que:');
  console.log('   1. BrowserPrint esté corriendo en localhost:9100');
  console.log('   2. El firewall permita puerto 9101');
  console.log('');
  console.log('Para detener: Ctrl + C');
  console.log('═══════════════════════════════════════════════════════════');
});

// Manejar cierre graceful
process.on('SIGINT', () => {
  console.log('\n\n🛑 Deteniendo proxy...');
  server.close(() => {
    console.log('✅ Proxy detenido');
    process.exit(0);
  });
});
