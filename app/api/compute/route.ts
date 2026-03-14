// /app/api/compute/route.ts
import { NextResponse } from "next/server";
import { computeHope } from "@/lib/engine";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const inputs = body?.inputs ?? {};

    const result = computeHope(inputs);

    return NextResponse.json(
      {
        ok: true,
        values: result.values,
        engine: result.engine
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Compute failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: true, message: "Use POST with JSON { inputs: {...} }" },
    { status: 200 }
  );
}
