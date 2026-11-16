/**
 * Mini-terminal script for the Security section. Generic, plausible output of standard commands
 * (example.com, no client data). Language-independent on purpose: it is decorative (aria-hidden)
 * and its meaning is given to screen readers once through t.home.security.terminalLabel.
 */
export type TermLine =
  | { kind: 'cmd'; text: string }
  | { kind: 'out'; text: string; tone?: 'dim' | 'ok' | 'head' }
  | { kind: 'gap' }

export const TERMINAL_TITLE = 'deploy@server: ~'

export const TERMINAL: readonly TermLine[] = [
  { kind: 'cmd', text: 'sudo sshd -T | grep passwordauth' },
  { kind: 'out', text: 'passwordauthentication no', tone: 'ok' },
  { kind: 'gap' },
  { kind: 'cmd', text: 'sudo ufw status' },
  { kind: 'out', text: 'Status: active', tone: 'ok' },
  { kind: 'out', text: 'To        Action   From', tone: 'head' },
  { kind: 'out', text: '22/tcp    ALLOW    Anywhere' },
  { kind: 'out', text: '80/tcp    ALLOW    Anywhere' },
  { kind: 'out', text: '443/tcp   ALLOW    Anywhere' },
  { kind: 'gap' },
  { kind: 'cmd', text: 'sudo certbot renew --dry-run' },
  { kind: 'out', text: 'Simulating renewal of an existing certificate for example.com', tone: 'dim' },
  { kind: 'out', text: 'Congratulations, all simulated renewals succeeded', tone: 'ok' },
]
