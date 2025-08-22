import { NextRequest, NextResponse } from "next/server";

export function GET() {
  const opciones: Intl.DateTimeFormatOptions = {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };

  const partes = new Intl.DateTimeFormat("en-US", opciones).formatToParts(
    new Date()
  );

  const fechaObjeto: { [key: string]: string } = {};
  for (const parte of partes) {
    if (parte.type !== "literal") {
      fechaObjeto[parte.type] = parte.value;
    }
  }

  const date = `${fechaObjeto.year}-${fechaObjeto.month}-${fechaObjeto.day}`;
  const time = `${fechaObjeto.hour}:${fechaObjeto.minute}:${fechaObjeto.second}`;
  const timestamp = `${date}T${time}Z`;

  return NextResponse.json({ date, time, timestamp });
}
