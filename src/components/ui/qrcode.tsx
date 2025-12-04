import React, { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
  variant?: "default" | "custom";
}

export const QRCodeComponent: React.FC<QRCodeProps> = ({ 
  value, 
  size = 128, 
  className = "",
  variant = "default"
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      if (variant === "custom") {
        // QR personalizado con estilo azul
        QRCode.toCanvas(canvasRef.current, value, {
          width: size,
          margin: 2,
          color: {
            dark: '#0055b8', // Azul
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'H' // Alto nivel de corrección para permitir logo
        }).then(() => {
          // Agregar logo en el centro después de generar el QR
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const centerX = canvas.width / 2;
              const centerY = canvas.height / 2;
              const logoSize = canvas.width * 0.15; // 15% del tamaño del QR
              
              // Crear imagen para el logo
              const logoImg = new Image();
              logoImg.onload = () => {
                // Círculo blanco de fondo
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(centerX, centerY, logoSize + 4, 0, 2 * Math.PI);
                ctx.fill();
                
                
                // Dibujar el logo icon.png en el centro
                const logoDrawSize = logoSize * 2; // Tamaño del logo a dibujar
                ctx.save();
                ctx.beginPath();
                ctx.arc(centerX, centerY, logoSize - 2, 0, 2 * Math.PI);
                ctx.clip(); // Recortar en círculo
                
                ctx.drawImage(
                  logoImg,
                  centerX - logoDrawSize / 2,
                  centerY - logoDrawSize / 2,
                  logoDrawSize,
                  logoDrawSize
                );
                ctx.restore();
              };
              logoImg.src = '/img/chide.svg';
            }
          }
        }).catch((err) => {
          console.error('Error generating custom QR code:', err);
        });
      } else {
        // QR estándar negro
        QRCode.toCanvas(canvasRef.current, value, {
          width: size,
          margin: 1,
          color: {
            dark: '#0055b8',
            light: '#FFFFFF'
          }
        }).catch((err) => {
          console.error('Error generating QR code:', err);
        });
      }
    }
  }, [value, size, variant]);

  return (
    <canvas 
      ref={canvasRef} 
      className={className}
      style={{ maxWidth: size, maxHeight: size }}
    />
  );
};

export default QRCodeComponent;