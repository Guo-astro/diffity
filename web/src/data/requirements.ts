export interface Requirement {
  name: string;
  tag: string;
  text: string;
}

export const REQUIREMENTS: Requirement[] = [
  { name: 'A Mac', tag: 'Needed', text: 'macOS 13.3 or later. Apple Silicon or Intel.' },
  { name: 'Claude Code or Codex', tag: 'For AI', text: 'One or both, installed and signed in. Review works without them.' },
  { name: 'Node.js', tag: 'For AI', text: 'Used to talk to your agent. Only the AI features need it.' },
];
