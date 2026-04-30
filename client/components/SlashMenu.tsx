export interface SlashCommand {
  command: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // GSD workflow commands
  { command: '/gsd:discuss-phase',   description: 'Discuss and clarify an upcoming phase' },
  { command: '/gsd:research-phase',  description: 'Research libraries / architecture for a phase' },
  { command: '/gsd:plan-phase',      description: 'Create execution plans for a phase' },
  { command: '/gsd:execute-phase',   description: 'Execute plans for a phase' },
  { command: '/gsd:verify-phase',    description: 'Verify phase against requirements' },
  { command: '/gsd:uat',             description: 'Run user acceptance testing for a phase' },
  { command: '/gsd:retrospective',   description: 'Generate phase retrospective' },
  { command: '/gsd:ship',            description: 'Tag and ship current milestone' },
  // Claude Code built-in
  { command: '/clear',               description: 'Clear conversation and free context' },
  { command: '/compact',             description: 'Compact conversation with summary' },
  { command: '/help',                description: 'Show Claude Code help' },
  { command: '/init',                description: 'Initialize CLAUDE.md for this project' },
  { command: '/login',               description: 'Switch Claude accounts' },
  { command: '/logout',              description: 'Logout from current account' },
  { command: '/model',               description: 'Set or show the current AI model' },
  { command: '/pr_comments',         description: 'View pull request comments' },
  { command: '/review',              description: 'Review a pull request' },
  { command: '/terminal-setup',      description: 'Set up terminal integration' },
  { command: '/vim',                 description: 'Toggle vim keybindings' },
];

interface SlashMenuProps {
  items: SlashCommand[];
  selectedIndex: number;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export default function SlashMenu({ items, selectedIndex, onSelect }: SlashMenuProps) {
  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 4px)',
        left: 0,
        right: 0,
        zIndex: 100,
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: '6px',
        maxHeight: '240px',
        overflowY: 'auto',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
      }}
      role="listbox"
    >
      {items.map((item, idx) => (
        <div
          key={item.command}
          role="option"
          aria-selected={idx === selectedIndex}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          style={{
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            gap: '12px',
            alignItems: 'baseline',
            background: idx === selectedIndex ? '#21262d' : 'transparent',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = idx === selectedIndex ? '#21262d' : '#1c2128';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = idx === selectedIndex ? '#21262d' : 'transparent';
          }}
        >
          <span
            style={{
              color: '#d4845a',
              fontFamily: 'monospace',
              fontSize: '13px',
              flexShrink: 0,
            }}
          >
            {item.command}
          </span>
          <span
            style={{
              color: '#8b949e',
              fontSize: '12px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.description}
          </span>
        </div>
      ))}
    </div>
  );
}
