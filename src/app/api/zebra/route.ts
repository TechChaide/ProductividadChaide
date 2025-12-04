import { NextRequest, NextResponse } from 'next/server';
import { generarZPL } from './functions/zebraParser';
import { sendToNetworkPrinter, PRINTER_PORT } from '../shared/networkPrinter';

type ZplInput = {
    orden: string | number;
    paquete: string | number;
    unidades: string | number;
    descripcionMaterial: string;
    codigoBarras: string;
    codigoEmpleado: string;
    printerIP?: string; // IP opcional de la impresora de red
};

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
            return NextResponse.json({ error: 'Payload vacío o inválido' }, { status: 400 });
        }

        const { orden, paquete, unidades, descripcionMaterial, codigoBarras, codigoEmpleado, printerIP } = item;
        if (!orden || !paquete || !unidades || !descripcionMaterial || !codigoBarras || !codigoEmpleado) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
        }

        const zpl = generarZPL(
            orden.toString(),
            paquete.toString(),
            unidades.toString(),
            descripcionMaterial,
            codigoBarras,
            codigoEmpleado
        );

        // Si se proporciona printerIP, imprimir directamente en red
        if (printerIP) {
            console.log(`[API /zebra] Imprimiendo en red: ${printerIP}`);
            try {
                const result = await sendToNetworkPrinter(zpl, printerIP);
                return NextResponse.json({ 
                    success: true,
                    message: result.message,
                    printer: `${printerIP}:${PRINTER_PORT}`,
                    orden: orden.toString(),
                    paquete: paquete.toString(),
                    unidades: unidades.toString()
                }, { status: 200 });
            } catch (error) {
                console.error('[API /zebra] Error en impresión de red:', error);
                return NextResponse.json({ 
                    error: error instanceof Error ? error.message : 'Error al imprimir en red',
                    printer: `${printerIP}:${PRINTER_PORT}`
                }, { status: 500 });
            }
        }

        // Si no hay printerIP, devolver ZPL para BrowserPrint
        console.log('[API /zebra] Devolviendo ZPL para BrowserPrint');
        return NextResponse.json({ zpl }, { status: 200 });
    } catch (error) {
        console.error('[API /zebra] Error:', error);
        return NextResponse.json({ error: 'Error procesando la solicitud' }, { status: 400 });
    }
}

