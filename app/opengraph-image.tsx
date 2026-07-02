import { ImageResponse } from 'next/og'

// Social share card, generated at build time. Served for og:image and
// twitter:image on every page that doesn't define its own.

export const alt = 'OrbitAPI — AI agents that operate your tools'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at 50% 120%, #2b2a6e 0%, #0b0b1a 60%, #07070f 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Orbit rings */}
        <div
          style={{
            position: 'absolute',
            width: 900,
            height: 900,
            borderRadius: 9999,
            border: '2px solid rgba(255,255,255,0.06)',
            top: 180,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 600,
            height: 600,
            borderRadius: 9999,
            border: '2px solid rgba(255,255,255,0.09)',
            top: 330,
            display: 'flex',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 24,
              background: 'linear-gradient(135deg, #5b5bd6 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Orbit mark: ring + moon, drawn so the build never fetches an emoji font */}
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 9999,
                border: '5px solid rgba(255,255,255,0.9)',
                display: 'flex',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -9,
                  right: -3,
                  width: 14,
                  height: 14,
                  borderRadius: 9999,
                  background: 'white',
                  display: 'flex',
                }}
              />
            </div>
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2, display: 'flex' }}>OrbitAPI</div>
        </div>
        <div style={{ fontSize: 38, color: 'rgba(255,255,255,0.85)', fontWeight: 600, display: 'flex' }}>
          AI agents that operate your tools
        </div>
        <div
          style={{
            marginTop: 26,
            fontSize: 24,
            color: 'rgba(255,255,255,0.5)',
            display: 'flex',
            gap: 18,
          }}
        >
          <span>100+ connectors</span>
          <span>·</span>
          <span>plain-English missions</span>
          <span>·</span>
          <span>try it with zero API keys</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
