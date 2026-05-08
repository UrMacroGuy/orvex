import { NextResponse } from "next/server";
import {
  ensureProfile,
  getRouteError,
  listProviderKeys,
  requireAuthenticatedUser,
} from "@/lib/server/auth";
import { storeProviderKey } from "@/lib/server/research";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    await ensureProfile(user);
    const keys = await listProviderKeys(user.id);
    return NextResponse.json({ data: keys });
  } catch (error) {
    const routeError = getRouteError(error, "Failed to load API keys");
    return NextResponse.json(
      { error: { message: routeError.message, code: routeError.code } },
      { status: routeError.status },
    );
  }
}

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
    const routeError = getRouteError(error, "Failed to store API key");
    return NextResponse.json(
      { error: { message: routeError.message, code: routeError.code } },
      { status: routeError.status },
    );
  }
}
