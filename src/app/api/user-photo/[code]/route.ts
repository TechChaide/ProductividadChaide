

import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest, context: { params: { code: string } }) {
  const { code } = await context.params;
  const basePath = path.join('\\\\192.168.7.51', 'Archivos Compartidos', 'Evolution', 'fotos');
  const exts = ['jpg', 'jpeg', 'png'];
  let filePath = null;
  let contentType = 'image/jpeg';

  for (const ext of exts) {
    const testPath = path.join(basePath, `${code}.${ext}`);
    try {
      await fs.access(testPath);
      filePath = testPath;
      if (ext === 'png') contentType = 'image/png';
      break;
    } catch {}
  }

  if (!filePath) {
    return new NextResponse('Imagen no encontrada', { status: 404 });
  }

  try {
  const imageBuffer = await fs.readFile(filePath);
  return new NextResponse(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      },
    });
  } catch (error) {
    return new NextResponse('Error leyendo imagen', { status: 500 });
  }
}