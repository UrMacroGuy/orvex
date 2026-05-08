import { NextResponse } from "next/server";
import { ensureProfile, requireAuthenticatedUser } from "@/lib/server/auth";
import { storeProviderKey } from "@/lib/server/research";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    await ensureProfile(user);

    const body = (await request.json()) as {
      provider_id?: string;
      key?: string;
      label?: string;
    };

    if (!body.provider_id || !body.key || !body.label) {
      return NextResponse.json(
        { error: { message: "provider_id, key, and label are required" } },
        { status: 400 },
      );
    }

    await storeProviderKey({
      userId: user.id,
      providerId: body.provider_id,
      label: body.label,
      secret: body.key,
    });

    return NextResponse.json({ data: { ok: true } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to store API key";
    return NextResponse.json(
      { error: { message } },
      { status: message === "Unauthorized" ? 401 : 500 },
    );
  }
}
