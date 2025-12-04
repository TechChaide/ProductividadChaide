import net from 'net';

const PRINTER_PORT = 9100;

/**
 * Envía código ZPL directamente a la impresora de red
 */
export async function sendToNetworkPrinter(zplCode: string, printerIP: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        client.setTimeout(5000);
        
        client.connect(PRINTER_PORT, printerIP, () => {
            console.log(`[NETWORK PRINT] Conectado a ${printerIP}:${PRINTER_PORT}`);
            client.write(zplCode, (err) => {
                if (err) {
                    client.destroy();
                    reject(new Error(`Error al enviar datos: ${err.message}`));
                } else {
                    console.log('[NETWORK PRINT] Datos enviados exitosamente');
                }
            });
        });
        
        client.on('timeout', () => {
            client.destroy();
            reject(new Error('Timeout: La impresora no respondió'));
        });
        
        client.on('error', (err: any) => {
            console.error('[NETWORK PRINT] Error:', err);
            let errorMessage = 'Error de conexión';
            switch (err.code) {
                case 'ETIMEDOUT':
                    errorMessage = 'Timeout: La impresora no responde';
                    break;
                case 'ECONNREFUSED':
                    errorMessage = 'Conexión rechazada: Verifica que la impresora esté encendida';
                    break;
                case 'ENETUNREACH':
                    errorMessage = 'Red no alcanzable: Verifica la configuración de red';
                    break;
                case 'EHOSTUNREACH':
                    errorMessage = `Host no alcanzable: ${printerIP}`;
                    break;
                default:
                    errorMessage = err.message;
            }
            reject(new Error(errorMessage));
        });
        
        client.on('close', () => {
            console.log('[NETWORK PRINT] Conexión cerrada');
            resolve({
                success: true,
                message: 'Impresión enviada exitosamente'
            });
        });
        
        setTimeout(() => {
            if (!client.destroyed) {
                client.end();
            }
        }, 1500);
    });
}

export { PRINTER_PORT };
