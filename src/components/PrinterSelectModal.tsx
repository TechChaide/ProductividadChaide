import React from 'react';

export interface Printer {
  name: string;
  ip: string;
}

interface PrinterSelectModalProps {
  printers: Printer[];
  open: boolean;
  onClose: () => void;
  onSelect: (printerIP: string, printerName: string) => void;
  loading?: boolean;
  error?: string | null;
}

export const PrinterSelectModal: React.FC<PrinterSelectModalProps> = ({ printers, open, onClose, onSelect, loading, error }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 8, padding: 24, minWidth: 400, maxWidth: 600 }}>
        <h2 style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 16 }}>Selecciona una impresora</h2>
        {loading && <div>Cargando impresoras...</div>}
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        <ul style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16, listStyle: 'none', padding: 0 }}>
          {printers.map((printer) => (
            <li key={printer.name} style={{ marginBottom: 8 }}>
              <button 
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: 12, 
                  borderRadius: 6, 
                  border: '1px solid #ccc', 
                  background: '#f9f9f9',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }} 
                onClick={() => onSelect(printer.ip, printer.name)}
                onMouseOver={(e) => e.currentTarget.style.background = '#e5e5e5'}
                onMouseOut={(e) => e.currentTarget.style.background = '#f9f9f9'}
              >
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{printer.name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>IP: {printer.ip}</div>
              </button>
            </li>
          ))}
        </ul>
        {printers.length === 0 && !loading && !error && (
          <div style={{ color: '#666', marginBottom: 16, textAlign: 'center' }}>
            No se encontraron impresoras
          </div>
        )}
        <button 
          onClick={onClose} 
          style={{ 
            background: '#0055b8', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: 6, 
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};
