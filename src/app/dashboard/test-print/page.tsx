'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePrinterIPs } from '@/hooks/usePrinterIPs';
import { useUser } from '@/context/user-context';
import { Printer, Network, MapPin, Info } from 'lucide-react';

export default function TestPrintPage() {
  const [loading, setLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<string>('');
  const { printerIPs, isLoading: isPrinterIPsLoading } = usePrinterIPs();
  const { user, estaciones, isLoading: isUserContextLoading } = useUser();
  
  // Obtener información de la estación del usuario
  const userStation = estaciones.find(e => e.direccion_ip === user?.ip_address);
  // IP de impresora configurada en la estación
  const printerIPSession = userStation?.ip_impresion || '';

  // Función para obtener la IP de impresora, preguntando al usuario si no está definida o vacía
  const getPrinterIP = async (): Promise<string> => {
    let ip: string | null = printerIPSession || null;
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    while (!ip || !ipRegex.test(ip)) {
      const userInput = prompt('Ingresa la IP de la impresora de red (formato: 192.168.1.100):', ip || '');
      if (userInput === null) return '';
      ip = userInput;
      if (!ipRegex.test(ip)) {
        alert('La IP ingresada no es válida. Debe tener el formato 192.168.x.x');
        ip = '';
      }
    }
    return ip;
  };

  const handlePrintNetworkSimple = async () => {
    setLoading(true);
    try {
      const ip = await getPrinterIP();
      if (!ip) {
        setLoading(false);
        return;
      }
      const response = await fetch('/api/zebra-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orden: 'TEST-001',
          paquete: '1',
          unidades: '10',
          descripcionMaterial: 'PRUEBA IMPRESORA RED',
          codigoBarras: 'TEST001-1',
          codigoEmpleado: user?.code || '000',
          printerIP: ip
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ Impresión exitosa!\n\nImpresora: ${result.printer}\nOrden: ${result.orden}\nPaquete: ${result.paquete}\nUnidades: ${result.unidades}`);
        setDiagnosticResult(`✅ Impresión en red exitosa - ${result.printer}`);
      } else {
        alert(`❌ Error al imprimir:\n\n${result.error}\n\nImpresora: ${result.printer}`);
        setDiagnosticResult(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      alert(`❌ Error de conexión:\n\n${errorMsg}\n\nVerifica que el servidor esté corriendo.`);
      setDiagnosticResult(`❌ Error de conexión: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintNetworkBarcode = async () => {
    const orderNumber = prompt('Ingresa el número de orden:', 'ORD-12345');
    if (!orderNumber) return;

    setLoading(true);
    try {
      const ip = await getPrinterIP();
      if (!ip) {
        setLoading(false);
        return;
      }
      const response = await fetch('/api/zebra-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orden: orderNumber,
          paquete: '1',
          unidades: '1',
          descripcionMaterial: 'PRUEBA CON CÓDIGO DE BARRAS',
          codigoBarras: `${orderNumber}-1`,
          codigoEmpleado: user?.code || '000',
          printerIP: ip
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ Etiqueta con código de barras enviada!\n\nOrden: ${orderNumber}\nImpresora: ${result.printer}`);
        setDiagnosticResult(`✅ Código de barras impreso - Orden: ${orderNumber}`);
      } else {
        alert(`❌ Error: ${result.error}`);
        setDiagnosticResult(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      alert(`❌ Error: ${errorMsg}`);
      setDiagnosticResult(`❌ Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintNetworkCustom = async () => {
    const orden = prompt('Número de orden:', '12345678');
    if (!orden) return;

    const paquete = prompt('Número de paquete:', '1');
    if (!paquete) return;

    const unidades = prompt('Cantidad de unidades:', '50');
    if (!unidades) return;

    const descripcion = prompt('Descripción del material:', 'Producto de prueba');
    if (!descripcion) return;

    setLoading(true);
    try {
      const ip = await getPrinterIP();
      if (!ip) {
        setLoading(false);
        return;
      }
      const response = await fetch('/api/zebra-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orden: orden,
          paquete: paquete,
          unidades: unidades,
          descripcionMaterial: descripcion,
          codigoBarras: `${orden}-${paquete}`,
          codigoEmpleado: user?.code || '000',
          printerIP: ip
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ Etiqueta personalizada enviada!\n\nOrden: ${orden}\nPaquete: ${paquete}\nUnidades: ${unidades}\nImpresora: ${result.printer}`);
        setDiagnosticResult(`✅ Etiqueta personalizada impresa - Orden: ${orden}`);
      } else {
        alert(`❌ Error: ${result.error}`);
        setDiagnosticResult(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      alert(`❌ Error: ${errorMsg}`);
      setDiagnosticResult(`❌ Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Prueba de Impresión en Red</h1>
        <p className="text-muted-foreground">
          Prueba la impresión directa a impresora de red sin BrowserPrint
        </p>
      </div>

      {/* Sección de Información de la Estación */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900 flex items-center gap-2">
            <Info className="h-5 w-5" />
            Información de la Estación
          </CardTitle>
          <CardDescription className="text-blue-700">
            Detalles de configuración actual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white p-4 rounded border border-blue-200 space-y-3">
            {/* IP del Usuario */}
            <div className="flex items-start gap-3">
              <Network className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">IP del Usuario</p>
                <p className="text-sm text-blue-700">
                  {user?.ip_address || 'No disponible'}
                </p>
              </div>
            </div>

            {/* Nombre de la Estación */}
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">Estación</p>
                <p className="text-sm text-blue-700">
                  {userStation?.nombre_estacion || 'No asignada'}
                </p>
              </div>
            </div>

            {/* IPs de Impresión Configuradas */}
            <div className="flex items-start gap-3">
              <Printer className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">Impresoras de Red Configuradas</p>
                {isPrinterIPsLoading ? (
                  <p className="text-sm text-blue-600">Cargando...</p>
                ) : printerIPs.length > 0 ? (
                  <div className="space-y-1">
                    {printerIPs.map((ip, index) => (
                      <p key={index} className="text-sm text-green-700 font-mono">
                        ✅ {ip}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-orange-600">
                    ⚠️ No hay impresoras de red configuradas para esta estación
                  </p>
                )}
              </div>
            </div>

            {/* Código de Usuario */}
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">Código de Usuario</p>
                <p className="text-sm text-blue-700">
                  {user?.code || 'No disponible'}
                </p>
              </div>
            </div>
          </div>

          {printerIPs.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <p className="text-xs text-green-800">
                <strong>✅ Configuración correcta:</strong> Esta estación tiene {printerIPs.length} impresora{printerIPs.length > 1 ? 's' : ''} de red configurada{printerIPs.length > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sección de Impresión en Red */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">🌐 Impresión Directa en Red</CardTitle>
          <CardDescription className="text-blue-700">
            Imprime directamente a la impresora de red ({printerIPSession ? printerIPSession : 'No configurada'}) sin BrowserPrint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-white p-3 rounded border border-blue-200 mb-3">
            <p className="text-sm text-blue-800 mb-2">
              <strong>📌 Impresora configurada:</strong> {printerIPSession ? `${printerIPSession}:9100` : 'No configurada'}
            </p>
            <p className="text-xs text-blue-600">
              ✨ Este método funciona desde PC y Tablets sin instalar nada
            </p>
          </div>

          <Button 
            onClick={handlePrintNetworkSimple}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
            variant="default"
          >
            🖨️ Imprimir Etiqueta Simple en Red
          </Button>

          <Button 
            onClick={handlePrintNetworkBarcode}
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            📊 Imprimir Código de Barras en Red
          </Button>

          <Button 
            onClick={handlePrintNetworkCustom}
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            ✏️ Imprimir Etiqueta Personalizada
          </Button>

          {diagnosticResult && (
            <div className={`p-3 rounded text-sm whitespace-pre-wrap ${
              diagnosticResult.startsWith('✅') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {diagnosticResult}
            </div>
          )}

          <div className="bg-green-50 border border-green-200 rounded p-3 mt-4">
            <p className="text-xs text-green-800">
              <strong>✅ Ventajas:</strong> No requiere BrowserPrint • Funciona desde tablets • Más confiable
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notas */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>💡 Notas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>Impresión en red:</strong> Funciona desde cualquier dispositivo conectado a la misma WiFi</p>
          <p>• <strong>Sin instalación:</strong> No requiere BrowserPrint ni software adicional</p>
          <p>• <strong>Compatible:</strong> Funciona en PC, tablets y smartphones</p>
          <p>• <strong>Configuración:</strong> La IP de la impresora se configura en el módulo de estaciones</p>
        </CardContent>
      </Card>
    </div>
  );
}
