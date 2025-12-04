import { NextRequest, NextResponse } from 'next/server';
import { generarZPL } from '../zebra/functions/zebraParser';
import net from 'net';

// Configuración de la impresora de red
const PRINTER_IP = '192.168.205.47';
const PRINTER_PORT = 9100;

type ZplInput = {
    orden?: string | number;
    paquete?: string | number;
    unidades?: string | number;
    descripcionMaterial?: string;
    codigoBarras?: string;
    codigoEmpleado?: string;
    printerIP?: string; // IP opcional de la impresora
    zpl?: string; // ZPL ya generado (opcional)
};

/**
 * Envía código ZPL directamente a la impresora de red
 */
async function sendToNetworkPrinter(zplCode: string, printerIP?: string): Promise<{ success: boolean; message: string }> {
    // Usar la IP proporcionada o la IP por defecto
    const targetIP = printerIP || PRINTER_IP;
    
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        
        // Timeout de 5 segundos
        client.setTimeout(5000);
        
        // Conectar a la impresora
        client.connect(PRINTER_PORT, targetIP, () => {
            console.log(`[NETWORK PRINT] Conectado a ${targetIP}:${PRINTER_PORT}`);
            
            // Enviar datos ZPL
            client.write(zplCode, (err) => {
                if (err) {
                    client.destroy();
                    reject(new Error(`Error al enviar datos: ${err.message}`));
                } else {
                    console.log('[NETWORK PRINT] Datos enviados exitosamente');
                }
            });
        });
        
        client.on('data', (data) => {
            console.log('[NETWORK PRINT] Respuesta:', data.toString());
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
                    errorMessage = `Host no alcanzable: ${targetIP}`;
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
        
        // Cerrar conexión después de 1.5 segundos
        setTimeout(() => {
            if (!client.destroyed) {
                client.end();
            }
        }, 1500);
    });
}

/**
 * POST /api/zebra-network
 * Genera ZPL y envía directamente a la impresora de red
 */
export async function POST(req: NextRequest) {
    try {
        const raw = await req.json();

        let item: ZplInput | null = null;
        if (Array.isArray(raw) && raw.length > 0) {
            item = raw[0];
        } else if (raw && typeof raw === 'object') {
            item = raw as ZplInput;
        }
        
        if (!item) {
            return NextResponse.json({ 
                success: false,
                error: 'Payload vacío o inválido' 
            }, { status: 400 });
        }

        const { orden, paquete, unidades, descripcionMaterial, codigoBarras, codigoEmpleado, printerIP, zpl: zplInput } = item;
        
        let zpl: string;
        
        // Si se proporciona ZPL directamente, usarlo
        if (zplInput && typeof zplInput === 'string') {
            console.log('[API] Usando ZPL proporcionado directamente');
            zpl = zplInput;
        } 
        // Si no, generar ZPL desde los parámetros
        else {
            if (!orden || !paquete || !unidades || !descripcionMaterial || !codigoBarras || !codigoEmpleado) {
                return NextResponse.json({ 
                    success: false,
                    error: 'Faltan campos requeridos para generar ZPL' 
                }, { status: 400 });
            }

            // Generar código ZPL
            zpl = generarZPL(
                orden.toString(),
                paquete.toString(),
                unidades.toString(),
                descripcionMaterial,
                codigoBarras,
                codigoEmpleado
            );
            console.log(`[API] Generado ZPL para orden ${orden}, paquete ${paquete}`);
        }

        console.log(`[API] Impresora destino: ${printerIP || PRINTER_IP}`);

        // Enviar a la impresora de red (usar IP proporcionada o la por defecto)
        const result = await sendToNetworkPrinter(zpl, printerIP);
        
        const targetIP = printerIP || PRINTER_IP;

        return NextResponse.json({ 
            success: true,
            message: result.message,
            printer: `${targetIP}:${PRINTER_PORT}`,
            orden: orden?.toString() || 'N/A',
            paquete: paquete?.toString() || 'N/A',
            unidades: unidades?.toString() || 'N/A'
        }, { status: 200 });

    } catch (error) {
        console.error('[API /zebra-network] Error:', error);
        
        return NextResponse.json({ 
            success: false,
            error: error instanceof Error ? error.message : 'Error procesando la solicitud',
            printer: `${PRINTER_IP}:${PRINTER_PORT}`
        }, { status: 500 });
    }
}

/**
 * GET /api/zebra-network
 * Verifica el estado de la impresora de red
 */
export async function GET(req: NextRequest) {
    return new Promise((resolve) => {
        const client = new net.Socket();
        
        client.setTimeout(3000);
        
        client.connect(PRINTER_PORT, PRINTER_IP, () => {
            console.log(`[STATUS] Impresora accesible: ${PRINTER_IP}:${PRINTER_PORT}`);
            client.end();
            
            resolve(NextResponse.json({
                available: true,
                printer: `${PRINTER_IP}:${PRINTER_PORT}`,
                message: 'Impresora de red disponible'
            }));
        });
        
        client.on('timeout', () => {
            client.destroy();
            resolve(NextResponse.json({
                available: false,
                printer: `${PRINTER_IP}:${PRINTER_PORT}`,
                error: 'Timeout: La impresora no respondió'
            }));
        });
        
        client.on('error', (err) => {
            resolve(NextResponse.json({
                available: false,
                printer: `${PRINTER_IP}:${PRINTER_PORT}`,
                error: err.message
            }));
        });
    });
}
