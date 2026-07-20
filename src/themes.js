// Room themes: the host picks one at room creation; both players' apps
// recolor to match. Each theme overrides the CSS variables set in :root.
export const THEMES = [
  {
    id: 'midnight',
    name: 'Midnight Classic',
    vars: {} // the :root defaults
  },
  {
    id: 'crimson',
    name: 'Crimson Pulse',
    vars: {
      '--bg': '#160a10', '--bg2': '#2a1020',
      '--gold': '#ef4d5e', '--gold-deep': '#c22738',
      '--blue': '#f08080', '--tile-hidden': '#2c1220', '--tile-border': '#57202f',
      '--glow1': '#4a1424', '--glow2': '#33101c'
    }
  },
  {
    id: 'goldrush',
    name: 'Gold Rush',
    vars: {
      '--bg': '#151003', '--bg2': '#2a2008',
      '--gold': '#ffd54a', '--gold-deep': '#e0a916',
      '--blue': '#f0c060', '--tile-hidden': '#2a2008', '--tile-border': '#57431a',
      '--glow1': '#4a3a10', '--glow2': '#33280c'
    }
  },
  {
    id: 'ocean',
    name: 'Ocean Deep',
    vars: {
      '--bg': '#04121c', '--bg2': '#0a2233',
      '--gold': '#3fc1f0', '--gold-deep': '#1793c4',
      '--blue': '#6ad4ff', '--tile-hidden': '#0c2334', '--tile-border': '#1c4460',
      '--glow1': '#0e3a52', '--glow2': '#0a2a3c'
    }
  },
  {
    id: 'emerald',
    name: 'Emerald Grove',
    vars: {
      '--bg': '#06140c', '--bg2': '#0c2818',
      '--gold': '#3fdf8f', '--gold-deep': '#1cb368',
      '--blue': '#6ae0aa', '--tile-hidden': '#0e2a1a', '--tile-border': '#1e4e32',
      '--glow1': '#12422a', '--glow2': '#0c2e1e'
    }
  },
  {
    id: 'violet',
    name: 'Violet Storm',
    vars: {
      '--bg': '#100a1c', '--bg2': '#201238',
      '--gold': '#a97ef5', '--gold-deep': '#7e4fd4',
      '--blue': '#c4a0ff', '--tile-hidden': '#221240', '--tile-border': '#3f2470',
      '--glow1': '#301a55', '--glow2': '#22123c'
    }
  },
  {
    id: 'sunset',
    name: 'Sunset Blaze',
    vars: {
      '--bg': '#170d05', '--bg2': '#2e1808',
      '--gold': '#ff8c42', '--gold-deep': '#d9661a',
      '--blue': '#ffb080', '--tile-hidden': '#2e1808', '--tile-border': '#5c3316',
      '--glow1': '#4e2a10', '--glow2': '#361d0c'
    }
  },
  {
    id: 'frost',
    name: 'Arctic Frost',
    vars: {
      '--bg': '#0a1218', '--bg2': '#14242e',
      '--gold': '#9fe6ff', '--gold-deep': '#5ec4e8',
      '--blue': '#c8f0ff', '--tile-hidden': '#152632', '--tile-border': '#2c4a5c',
      '--glow1': '#1c3a4a', '--glow2': '#142a36'
    }
  },
  {
    id: 'rose',
    name: 'Rose Quartz',
    vars: {
      '--bg': '#170a12', '--bg2': '#2c1224',
      '--gold': '#f57ab8', '--gold-deep': '#d14a92',
      '--blue': '#ffa0d0', '--tile-hidden': '#2e1224', '--tile-border': '#582442',
      '--glow1': '#4a1a38', '--glow2': '#341228'
    }
  },
  {
    id: 'lime',
    name: 'Electric Lime',
    vars: {
      '--bg': '#0e1404', '--bg2': '#1c280a',
      '--gold': '#b8e63f', '--gold-deep': '#8cba1c',
      '--blue': '#d4f06a', '--tile-hidden': '#1e2a0c', '--tile-border': '#3c4e1c',
      '--glow1': '#2e4212', '--glow2': '#20300c'
    }
  }
]

const THEME_VARS = [
  '--bg', '--bg2', '--gold', '--gold-deep', '--blue',
  '--tile-hidden', '--tile-border', '--glow1', '--glow2'
]

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}

// Apply a theme's variables to the document; null/'midnight' restores defaults.
export function applyTheme(id) {
  const root = document.documentElement
  THEME_VARS.forEach((v) => root.style.removeProperty(v))
  Object.entries(getTheme(id).vars).forEach(([v, value]) => root.style.setProperty(v, value))
}
