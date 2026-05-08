export interface ProviderUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ProviderResult {
  text: string;
  usage?: ProviderUsage;
}

function resolveServerProviderApiKey(providerId: string) {
  switch (providerId) {
    case "openai":
      return process.env.OPENAI_API_KEY ?? null;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY ?? null;
    case "gemini":
      return (
        process.env.GEMINI_API_KEY ??
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
        null
      );
    case "openrouter":
      return process.env.OPENROUTER_API_KEY ?? null;
    default:
      return null;
  }
}

async function postJson(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Provider request failed with ${response.status}`);
  }

  return response.json();
}

export async function runModelCompletion(input: {
  providerId: string;
  modelId: string;
  apiKey?: string | null;
  prompt: string;
}) {
  const resolvedInput = {
    ...input,
    apiKey: input.apiKey ?? resolveServerProviderApiKey(input.providerId),
  };

  switch (input.providerId) {
    case "openai":
      return runOpenAI(resolvedInput);
    case "anthropic":
      return runAnthropic(resolvedInput);
    case "gemini":
      return runGemini(resolvedInput);
    case "openrouter":
      return runOpenRouter(resolvedInput);
    default:
      throw new Error(`Unsupported provider: ${input.providerId}`);
  }
}

async function runOpenAI(input: {
  providerId: string;
  modelId: string;
  apiKey?: string | null;
  prompt: string;
}): Promise<ProviderResult> {
  if (!input.apiKey) {
    throw new Error("OpenAI API key is not configured");
  }

  const data = await postJson("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.modelId,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a financial research analyst. Produce concise, evidence-driven analysis with clear risks and catalysts.",
        },
        {
          role: "user",
          content: input.prompt,
        },
      ],
    }),
  });

  return {
    text: data.choices?.[0]?.message?.content ?? "",
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

async function runAnthropic(input: {
  providerId: string;
  modelId: string;
  apiKey?: string | null;
  prompt: string;
}): Promise<ProviderResult> {
  if (!input.apiKey) {
    throw new Error("Anthropic API key is not configured");
  }

  const data = await postJson("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.modelId,
      max_tokens: 2048,
      system:
        "You are a financial research analyst. Produce concise, evidence-driven analysis with clear risks and catalysts.",
      messages: [{ role: "user", content: input.prompt }],
    }),
  });

  return {
    text: (data.content ?? [])
      .filter((item: { type?: string }) => item.type === "text")
      .map((item: { text?: string }) => item.text ?? "")
      .join("\n"),
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
  };
}

async function runGemini(input: {
  providerId: string;
  modelId: string;
  apiKey?: string | null;
  prompt: string;
}): Promise<ProviderResult> {
  if (!input.apiKey) {
    throw new Error("Gemini API key is not configured");
  }

  const data = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.modelId)}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "You are a financial research analyst. Produce concise, evidence-driven analysis with clear risks and catalysts.\n\n" +
                  input.prompt,
              },
            ],
          },
        ],
      }),
    },
  );

  return {
    text:
      data.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("\n") ?? "",
  };
}

async function runOpenRouter(input: {
  providerId: string;
  modelId: string;
  apiKey?: string | null;
  prompt: string;
}): Promise<ProviderResult> {
  if (!input.apiKey) {
    throw new Error("OpenRouter API key is not configured");
  }

  const data = await postJson("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.modelId,
      messages: [
        {
          role: "system",
          content:
            "You are a financial research analyst. Produce concise, evidence-driven analysis with clear risks and catalysts.",
        },
        {
          role: "user",
          content: input.prompt,
        },
      ],
    }),
  });

  return {
    text: data.choices?.[0]?.message?.content ?? "",
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
