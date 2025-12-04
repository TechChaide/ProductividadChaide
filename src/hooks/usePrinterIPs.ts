import { useEffect, useState } from 'react';
import { estacionService } from '@/services/estacion.service';

/**
 * Hook personalizado para obtener las IPs de impresión asociadas a la estación actual
 * Consulta el servicio getEstacionesByIP y almacena las IPs en sessionStorage
 */
export function usePrinterIPs() {
  const [printerIPs, setPrinterIPs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrinterIPs = async () => {
      try {
        // Obtener la IP del usuario desde localStorage
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          setIsLoading(false);
          return;
        }

        const user = JSON.parse(userStr);
        const userIP = user.ip_address;

        if (!userIP) {
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);

        // Consultar las estaciones asociadas a esta IP
        const response = await estacionService.getEstacionesByIP(userIP);
        
        // Extraer las IPs de impresión de las estaciones devueltas
        const ips: string[] = [];
        
        if (response.data) {
          // Si es un solo objeto
          if (!Array.isArray(response.data)) {
            if (response.data.ip_impresion) {
              ips.push(response.data.ip_impresion);
            }
          } else {
            // Si es un array de estaciones
            response.data.forEach((estacion: any) => {
              if (estacion.ip_impresion) {
                ips.push(estacion.ip_impresion);
              }
            });
          }
        }

        // Guardar en sessionStorage
        if (ips.length > 0) {
          sessionStorage.setItem('IP_impresion', JSON.stringify(ips));
          setPrinterIPs(ips);
          console.log('[PRINTER IPs] IPs de impresión cargadas:', ips);
        } else {
          console.log('[PRINTER IPs] No se encontraron IPs de impresión para esta estación');
          sessionStorage.removeItem('IP_impresion');
          setPrinterIPs([]);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al obtener IPs de impresión';
        console.error('[PRINTER IPs] Error:', errorMessage);
        setError(errorMessage);
        sessionStorage.removeItem('IP_impresion');
        setPrinterIPs([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrinterIPs();
  }, []); // Solo se ejecuta una vez al montar el componente

  return {
    printerIPs,
    isLoading,
    error,
  };
}
