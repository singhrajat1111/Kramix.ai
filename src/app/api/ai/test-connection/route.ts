import { NextRequest, NextResponse } from "next/server";
import { getLLMProvider } from "@/lib/ai/factory";
import { AIConfig } from "@/types/ai";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AIConfig;
    const provider = getLLMProvider(body);
    const result = await provider.testConnection();
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Internal server error testing AI provider connection",
      },
      { status: 500 }
    );
  }
}
