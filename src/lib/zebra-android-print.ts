/**
 * Sistema de impresión Zebra
 * Soporta BrowserPrint (local o remoto) y fallback a Intent URLs
 */

/**
 * Obtiene el host donde corre BrowserPrint
 * - Si hay variable de entorno, usa esa
 * - Si accedes desde IP (ej: 192.168.1.100:3000), usa esa misma IP para BrowserPrint
 * - Si accedes desde localhost, usa localhost
 */
function getBrowserPrintHost(): string {
  // 1. Variable de entorno (producción)
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BROWSERPRINT_HOST) {
    return process.env.NEXT_PUBLIC_BROWSERPRINT_HOST;
  }
  
  // 2. Detectar hostname actual
  if (typeof window !== 'undefined') {
    const currentHost = window.location.hostname;
    
    // Si NO es localhost, usar ese host (ej: 192.168.1.100)
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1' && currentHost !== '') {
      console.log(`[ZEBRA] Detectado acceso remoto desde ${currentHost}, usando mismo host para BrowserPrint`);
      return currentHost;
    }
  }
  
  // 3. Fallback a localhost
  return 'localhost';
}

/**
 * Imprime una etiqueta usando BrowserPrint
 */
export async function printZebraLabel(zplCode: string): Promise<void> {
  const host = getBrowserPrintHost();
  const port = 9100;
  
  console.log(`[ZEBRA] Imprimiendo en: ${host}:${port}`);
  
  try {
    // Verificar si BrowserPrint está disponible
    const checkUrl = `http://${host}:${port}/available`;
    console.log(`[ZEBRA] Verificando: ${checkUrl}`);
    
    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      signal: AbortSignal.timeout(5000) // Timeout 5 segundos
    });
    
    if (!checkResponse.ok) {
      throw new Error(`BrowserPrint respondió con error: ${checkResponse.status}`);
    }
    
    console.log('[ZEBRA] ✅ BrowserPrint disponible');
    
    // Obtener impresora por defecto
    const bp = (window as any).BrowserPrint;
    if (!bp) {
      throw new Error('BrowserPrint script no cargado');
    }
    
    // Obtener impresora por defecto
    bp.getDefaultDevice(
      'printer',
      (printer: any) => {
        if (!printer) {
          throw new Error('No hay impresora configurada');
        }
        
        console.log('[ZEBRA] 🖨️ Impresora:', printer.name);
        
        // Enviar ZPL a imprimir
        printer.send(
          zplCode,
          () => {
            console.log('[ZEBRA] ✅ Impresión exitosa');
            alert('✅ Etiqueta enviada a imprimir');
          },
          (error: string) => {
            console.error('[ZEBRA] ❌ Error al imprimir:', error);
            alert(`❌ Error al imprimir: ${error}`);
          }
        );
      },
      (error: string) => {
        console.error('[ZEBRA] ❌ Error al obtener impresora:', error);
        alert(`❌ No se pudo obtener impresora: ${error}`);
      }
    );
    
  } catch (error) {
    console.error('[ZEBRA] ❌ Error:', error);
    
    let errorMessage = '❌ Error al imprimir\n\n';
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage += `No se puede conectar a BrowserPrint en ${host}:${port}\n\n`;
      errorMessage += 'Verifica:\n';
      errorMessage += `1. BrowserPrint está corriendo en el PC (${host})\n`;
      errorMessage += '2. El firewall permite puerto 9100\n';
      errorMessage += '3. Estás en la misma red WiFi\n';
      errorMessage += `4. Prueba abrir: http://${host}:9100`;
    } else if (error instanceof Error) {
      errorMessage += error.message;
    } else {
      errorMessage += 'Error desconocido';
    }
    
    alert(errorMessage);
    throw error;
  }
}

/**
 * Verifica si BrowserPrint está disponible
 */
export async function checkBrowserPrint(): Promise<{ available: boolean; host: string; error?: string }> {
  const host = getBrowserPrintHost();
  const port = 9100;
  
  try {
    const checkUrl = `http://${host}:${port}/available`;
    console.log(`[ZEBRA] Verificando: ${checkUrl}`);
    
    const response = await fetch(checkUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      console.log('[ZEBRA] ✅ BrowserPrint disponible');
      return { available: true, host: `${host}:${port}` };
    } else {
      return { 
        available: false, 
        host: `${host}:${port}`,
        error: `HTTP ${response.status}` 
      };
    }
  } catch (error) {
    console.error('[ZEBRA] ❌ Error al verificar:', error);
    return { 
      available: false, 
      host: `${host}:${port}`,
      error: error instanceof Error ? error.message : 'No se pudo conectar'
    };
  }
}

/**
 * Carga el script de BrowserPrint si no está cargado
 */
export async function loadBrowserPrintScript(): Promise<void> {
  // Si ya está cargado, no hacer nada
  if ((window as any).BrowserPrint) {
    console.log('[ZEBRA] BrowserPrint ya está cargado');
    return;
  }

  const host = getBrowserPrintHost();
  const scriptUrl = `http://${host}:9100/BrowserPrint-3.1.250.min.js`;
  
  console.log(`[ZEBRA] Cargando BrowserPrint desde: ${scriptUrl}`);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    
    script.onload = () => {
      console.log('[ZEBRA] ✅ BrowserPrint cargado correctamente');
      resolve();
    };
    
    script.onerror = () => {
      const error = `No se pudo cargar BrowserPrint desde ${scriptUrl}`;
      console.error('[ZEBRA] ❌', error);
      reject(new Error(error));
    };
    
    document.head.appendChild(script);
  });
}

/**
 * Ejemplo de etiqueta simple para pruebas
 * Etiqueta: 4" x 2" (101.6mm x 50.8mm)
 * Resolución: 203 DPI
 */
export function getSimpleTestLabel(): string {
  return `
^XA
^FO50,50^A0N,40,40^FDPrueba de Impresion^FS
^FO50,100^A0N,30,30^FDDesde Windows^FS
^FO50,140^A0N,30,30^FDvia BrowserPrint^FS
^FO50,180^A0N,25,25^FDFecha: ${new Date().toLocaleDateString()}^FS
^FO50,210^A0N,25,25^FDHora: ${new Date().toLocaleTimeString()}^FS
^XZ
`.trim();
}

/**
 * Etiqueta con código de barras
 */
export function getBarcodeTestLabel(orderNumber: string): string {
  return `
^XA
^FO50,30^A0N,30,30^FDOrden: ${orderNumber}^FS
^FO50,80^BY2^BCN,80,Y,N,N^FD${orderNumber}^FS
^FO50,180^A0N,25,25^FDFecha: ${new Date().toLocaleDateString()}^FS
^XZ
`.trim();
}

/**
 * Etiqueta con código QR
 */
export function getQRTestLabel(data: string): string {
  return `
^XA
^FO50,30^A0N,30,30^FDCodigo QR^FS
^FO50,80^BQN,2,4^FDQA,${data}^FS
^FO50,220^A0N,20,20^FD${data}^FS
^XZ
`.trim();
}
