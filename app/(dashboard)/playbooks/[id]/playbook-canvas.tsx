'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position, MarkerType,
  useNodesState, useEdgesState, addEdge,
  type Node, type Edge, type Connection, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Gauge, GitBranch, Bell, Clock, ShieldCheck, Wrench, Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export type NodeType = 'assess' | 'action' | 'condition' | 'approval' | 'notify' | 'wait'
export interface PlaybookNode {
  id: string
  name: string
  type: NodeType
  connection_id?: string
  action_slug?: string
  prompt?: string
  expr?: string
  on_true?: string
  on_false?: string
  message?: string
  wait_seconds?: number
  wait_event?: string
  next?: string
  position?: { x: number; y: number }
}
export interface AvailableConn { connectionId: string; label: string; actions: { slug: string; name: string; risk: string }[] }

const META: Record<NodeType, { label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; hint: string; color: string }> = {
  assess:    { label: 'Assess', icon: Gauge, hint: 'AI reads data and scores confidence 0–10', color: 'oklch(0.72 0.16 274)' },
  action:    { label: 'Action', icon: Wrench, hint: 'Run a connector action (gated by autonomy policy)', color: 'oklch(0.7 0.15 200)' },
  condition: { label: 'Condition', icon: GitBranch, hint: 'Branch on state, e.g. state.open > 0', color: 'oklch(0.78 0.15 90)' },
  approval:  { label: 'Approval', icon: ShieldCheck, hint: 'Pause for a human to approve', color: 'oklch(0.78 0.16 60)' },
  notify:    { label: 'Notify', icon: Bell, hint: 'Send a notification, never writes', color: 'oklch(0.72 0.14 150)' },
  wait:      { label: 'Wait', icon: Clock, hint: 'Pause for a timer or external event', color: 'oklch(0.7 0.05 274)' },
}

type RFData = { node: PlaybookNode }

// ── Custom node card ──────────────────────────────────────────────────────────
function StepNode({ data, selected }: NodeProps) {
  const n = (data as RFData).node
  const m = META[n.type]
  const Icon = m.icon
  return (
    <div
      className={`rounded-xl border-2 bg-card px-3 py-2 w-[180px] shadow-sm transition-colors ${selected ? 'border-primary' : 'border-border'}`}
      style={{ borderColor: selected ? undefined : `color-mix(in oklch, ${m.color} 35%, transparent)` }}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: m.color }} />
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</span>
      </div>
      <p className="text-sm font-medium truncate mt-0.5">{n.name}</p>
      {n.type === 'condition' ? (
        <>
          <Handle id="true" type="source" position={Position.Bottom} style={{ left: '30%', background: 'oklch(0.7 0.18 150)' }} />
          <Handle id="false" type="source" position={Position.Bottom} style={{ left: '70%', background: 'oklch(0.65 0.2 25)' }} />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!bg-primary" />
      )}
    </div>
  )
}

const NODE_TYPES = { pb: StepNode }

function edgeOf(source: string, target: string, handle: 'true' | 'false' | null): Edge {
  return {
    id: `${source}:${handle ?? 'next'}->${target}`,
    source,
    target,
    sourceHandle: handle ?? undefined,
    label: handle ?? undefined,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: handle === 'false' ? { stroke: 'oklch(0.65 0.2 25)' } : handle === 'true' ? { stroke: 'oklch(0.55 0.18 150)' } : undefined,
  }
}

// steps → React Flow nodes/edges (positions auto-stacked when missing)
function seed(steps: PlaybookNode[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = steps.map((s, i) => ({
    id: s.id,
    type: 'pb',
    position: s.position ?? { x: 60, y: i * 130 },
    data: { node: s },
  }))
  const edges: Edge[] = []
  steps.forEach((s, i) => {
    if (s.type === 'condition') {
      if (s.on_true) edges.push(edgeOf(s.id, s.on_true, 'true'))
      if (s.on_false) edges.push(edgeOf(s.id, s.on_false, 'false'))
    } else {
      const target = s.next ?? steps[i + 1]?.id // materialize implicit sequential flow
      if (target) edges.push(edgeOf(s.id, target, null))
    }
  })
  return { nodes, edges }
}

export function PlaybookCanvas({ steps, onChange, availableActions }: {
  steps: PlaybookNode[]; onChange: (s: PlaybookNode[]) => void; availableActions: AvailableConn[]
}) {
  const seeded = useMemo(() => seed(steps), []) // seed once; canvas is then self-contained
  const [nodes, setNodes, onNodesChange] = useNodesState(seeded.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(seeded.edges)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const nodesRef = useRef(nodes); nodesRef.current = nodes
  const edgesRef = useRef(edges); edgesRef.current = edges

  // Rebuild the canonical steps[] from current nodes + edges and push up. Order
  // is preserved from the incoming steps (entry point = first), new nodes append.
  const commit = useCallback((nextNodes: Node[], nextEdges: Edge[]) => {
    const byId = new Map(nextNodes.map(n => [n.id, n]))
    const order = [...steps.map(s => s.id).filter(id => byId.has(id)), ...nextNodes.map(n => n.id).filter(id => !steps.some(s => s.id === id))]
    const result: PlaybookNode[] = order.map(id => {
      const rf = byId.get(id)!
      const base = { ...(rf.data as RFData).node, position: rf.position }
      // Reset flow pointers, then set from edges
      base.next = undefined; base.on_true = undefined; base.on_false = undefined
      for (const e of nextEdges) {
        if (e.source !== id) continue
        if (base.type === 'condition') {
          if (e.sourceHandle === 'true') base.on_true = e.target
          else if (e.sourceHandle === 'false') base.on_false = e.target
        } else {
          base.next = e.target
        }
      }
      return base
    })
    onChange(result)
  }, [steps, onChange])

  const onConnect = useCallback((c: Connection) => {
    setEdges(eds => {
      // one outgoing edge per (source, handle) — replace any existing
      const filtered = eds.filter(e => !(e.source === c.source && (e.sourceHandle ?? null) === (c.sourceHandle ?? null)))
      const next = addEdge(edgeOf(c.source!, c.target!, (c.sourceHandle as 'true' | 'false' | null) ?? null), filtered)
      queueMicrotask(() => commit(nodesRef.current, next))
      return next
    })
  }, [setEdges, commit])

  const onNodeDragStop = useCallback(() => commit(nodesRef.current, edgesRef.current), [commit])

  function patchSelected(patch: Partial<PlaybookNode>) {
    setNodes(ns => {
      const next = ns.map(n => n.id === selectedId ? { ...n, data: { node: { ...(n.data as RFData).node, ...patch } } } : n)
      queueMicrotask(() => commit(next, edgesRef.current))
      return next
    })
  }

  function addNode(type: NodeType) {
    const id = `${type}_${Date.now().toString(36)}`
    const node: Node = {
      id, type: 'pb',
      position: { x: 320, y: (nodesRef.current.length % 6) * 120 + 40 },
      data: { node: { id, name: META[type].label, type } },
    }
    setNodes(ns => { const next = [...ns, node]; queueMicrotask(() => commit(next, edgesRef.current)); return next })
    setSelectedId(id)
  }

  function deleteSelected() {
    if (!selectedId) return
    const nextNodes = nodesRef.current.filter(n => n.id !== selectedId)
    const nextEdges = edgesRef.current.filter(e => e.source !== selectedId && e.target !== selectedId)
    setNodes(nextNodes); setEdges(nextEdges); setSelectedId(null)
    commit(nextNodes, nextEdges)
  }

  const selected = nodes.find(n => n.id === selectedId)
  const selectedNode = selected ? (selected.data as RFData).node : null

  return (
    <div className="border rounded-xl overflow-hidden bg-card">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(META) as NodeType[]).map(t => {
            const Icon = META[t].icon
            return (
              <Button key={t} variant="outline" size="xs" onClick={() => addNode(t)}>
                <Plus className="h-3 w-3" /> <Icon className="h-3 w-3" /> {META[t].label}
              </Button>
            )
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">Drag to arrange · drag a dot to connect steps · click a step to edit</p>
      </div>

      <div className="flex" style={{ height: 520 }}>
        <div className="flex-1 min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            onEdgesDelete={() => queueMicrotask(() => commit(nodesRef.current, edgesRef.current))}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-muted" />
          </ReactFlow>
        </div>

        {/* Config side panel */}
        <div className="w-72 shrink-0 border-l p-3 overflow-y-auto">
          {!selectedNode && <p className="text-sm text-muted-foreground">Select a step to configure it, or add one from the toolbar.</p>}
          {selectedNode && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{META[selectedNode.type].label}</span>
                <Button variant="ghost" size="icon-sm" onClick={deleteSelected} title="Delete step"><X className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input value={selectedNode.name} onChange={e => patchSelected({ name: e.target.value })} className="h-8" />
              </div>

              {selectedNode.type === 'assess' && (
                <textarea value={selectedNode.prompt ?? ''} onChange={e => patchSelected({ prompt: e.target.value })} rows={3}
                  placeholder="What should the AI evaluate?" className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm" />
              )}

              {selectedNode.type === 'action' && (
                <div className="space-y-2">
                  <select value={selectedNode.connection_id ?? ''} onChange={e => patchSelected({ connection_id: e.target.value, action_slug: '' })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Connection…</option>
                    {availableActions.map(a => <option key={a.connectionId} value={a.connectionId}>{a.label}</option>)}
                  </select>
                  <select value={selectedNode.action_slug ?? ''} onChange={e => patchSelected({ action_slug: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm" disabled={!selectedNode.connection_id}>
                    <option value="">Action…</option>
                    {(availableActions.find(a => a.connectionId === selectedNode.connection_id)?.actions ?? []).map(act => (
                      <option key={act.slug} value={act.slug}>{act.name}{act.risk !== 'read' ? ` (${act.risk})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedNode.type === 'condition' && (
                <div className="space-y-1.5">
                  <Input value={selectedNode.expr ?? ''} onChange={e => patchSelected({ expr: e.target.value })} placeholder="state.open_detections > 0" className="h-8" />
                  <p className="text-[11px] text-muted-foreground">Connect the <span className="text-green-500 font-medium">true</span> (left) and <span className="text-red-500 font-medium">false</span> (right) dots to the next steps.</p>
                </div>
              )}

              {selectedNode.type === 'notify' && (
                <Input value={selectedNode.message ?? ''} onChange={e => patchSelected({ message: e.target.value })} placeholder="Message — supports {{state.xyz}}" className="h-8" />
              )}

              {selectedNode.type === 'wait' && (
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" value={selectedNode.wait_seconds ?? ''} onChange={e => patchSelected({ wait_seconds: Number(e.target.value) || undefined })} placeholder="Seconds" className="h-8" />
                  <Input value={selectedNode.wait_event ?? ''} onChange={e => patchSelected({ wait_event: e.target.value || undefined })} placeholder="…or event" className="h-8" />
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">{META[selectedNode.type].hint}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
