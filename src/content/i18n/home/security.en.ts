/** Home section copy: security (EN). Must have exactly the shape of the Indonesian copy in ./security.ts. */
import type { security as idCopy } from './security'

export const security: typeof idCopy = {
  eyebrow: 'Security & governance',
  title: 'Locked down from day one, not after a breach.',
  lead: 'Every server we hand over is set up to the same security baseline. You do not need to know Linux to know that every door is firmly shut.',
  vault: {
    kicker: 'Production server status',
    state: 'Locked',
    checks: 'SSH keys · Firewall · SSL · Backups',
  },
  terminalLabel:
    'Terminal illustration. The SSH check shows password login is disabled. The firewall is active and only allows ports 22, 80 and 443. The SSL certificate renewal test succeeds.',
  note: 'An illustration of standard commands, not a recording of a client server.',
  cards: [
    {
      title: 'Key-only SSH login',
      body: 'Password login is switched off. The server only accepts the cryptographic keys of authorised people, so password-guessing bots have nothing to work with.',
      spec: 'PasswordAuthentication no',
    },
    {
      title: 'Firewall: only three doors open',
      body: 'Every port is closed except 22 (SSH), 80 (HTTP) and 443 (HTTPS). Databases and internal services cannot be reached directly from the internet.',
      spec: 'ufw allow 22,80,443/tcp',
    },
    {
      title: 'SSL that renews itself',
      body: 'HTTPS certificates renew automatically before they expire and the renewal is tested regularly. Visitors never get greeted by a “not secure” warning.',
      spec: 'certbot renew --dry-run',
    },
    {
      title: 'Production hardening',
      body: 'Security updates are applied routinely, each service only gets the access it truly needs, and data is backed up on a schedule to a separate location.',
      spec: 'updates · least privilege · backup',
    },
  ],
  cta: 'Ask about server security',
  waText: 'Hi GAMADA, I would like to ask about server security for my business.',
}
