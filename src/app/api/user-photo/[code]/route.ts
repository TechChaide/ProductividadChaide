import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const EXTENSIONS = ['jpg', 'JPG', 'jpeg', 'JPEG', 'png', 'PNG'];

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  const { code } = params;
  const networkBasePath = path.join('\\\\192.168.7.214', 'Evolution', 'fotos');

  let foundPath: string | null = null;

  for (const ext of EXTENSIONS) {
    const filePath = path.join(networkBasePath, `${code}.${ext}`);
    try {
      await fs.access(filePath);
      foundPath = filePath;
      break;
    } catch {
      continue;
    }
  }

  if (!foundPath) {
    return new NextResponse('Image not found', { status: 404 });
  }

  try {
    const imageBuffer = await fs.readFile(foundPath);
    
    // 👇 SOLUCIÓN DEFINITIVA: Conversión manual a un tipo puro y estándar.
    const uint8Array = new Uint8Array(imageBuffer);

    // Creamos el Blob a partir de este nuevo tipo universal.
    const blob = new Blob([uint8Array], { type: 'image/jpeg' });

    // Y ahora le pasamos el Blob a la respuesta.
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error reading file from network share:', error);
    return new NextResponse('Error reading image file', { status: 500 });
  }
}