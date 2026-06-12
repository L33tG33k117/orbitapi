export function ActionDebugPanel({ data }: { data: { slug: string; name: string; result: unknown }[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No read actions available.</p>

  return (
    <div className="space-y-3">
      {data.map(item => (
        <div key={item.slug} className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 text-xs font-mono text-muted-foreground">{item.slug}</div>
          <pre className="p-4 text-xs overflow-x-auto max-h-64 bg-background">
            {JSON.stringify(item.result, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}
