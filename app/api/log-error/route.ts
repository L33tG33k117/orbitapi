export async function POST(req: Request) {
  try {
    const { message, stack, url, digest, context } = await req.json()
    console.error(
      `[CLIENT ERROR]${context ? ` [${context}]` : ''}\n` +
      `  URL:    ${url ?? 'unknown'}\n` +
      `  Digest: ${digest ?? 'none'}\n` +
      `  Error:  ${message}\n` +
      (stack ? `  Stack:\n${stack.split('\n').map((l: string) => `    ${l}`).join('\n')}` : '')
    )
  } catch {
    // malformed body — ignore
  }
  return new Response(null, { status: 204 })
}
