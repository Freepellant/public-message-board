import type { ReactNode } from "react";

interface MuPageRendererProps {
  content: string;
}

// ── Inline renderer ──────────────────────────────────────────────────────────
// Converts a plain text segment into React nodes honouring:
// **bold**, *em*, _em_, `code`, [label](url), bare https?:// URLs

type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "em"; value: string }
  | { kind: "code"; value: string }
  | { kind: "link"; label: string; href: string };

function tokeniseInline(raw: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  // Combined pattern — order matters (bold before italic)
  const pattern =
    /\*\*(.+?)\*\*|(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|\b_(.+?)_\b|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"]+)/g;

  let lastIndex = 0;

  for (;;) {
    const match = pattern.exec(raw);
    if (match === null) break;
    // Text before this match
    if (match.index > lastIndex) {
      tokens.push({ kind: "text", value: raw.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      tokens.push({ kind: "bold", value: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ kind: "em", value: match[2] });
    } else if (match[3] !== undefined) {
      tokens.push({ kind: "em", value: match[3] });
    } else if (match[4] !== undefined) {
      tokens.push({ kind: "code", value: match[4] });
    } else if (match[5] !== undefined && match[6] !== undefined) {
      tokens.push({ kind: "link", label: match[5], href: match[6] });
    } else if (match[7] !== undefined) {
      tokens.push({ kind: "link", label: match[7], href: match[7] });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < raw.length) {
    tokens.push({ kind: "text", value: raw.slice(lastIndex) });
  }

  return tokens;
}

function renderInlineTokens(
  tokens: InlineToken[],
  keyPrefix: string,
): ReactNode[] {
  return tokens.map((t, i) => {
    const k = `${keyPrefix}-${i}`;
    switch (t.kind) {
      case "bold":
        return <strong key={k}>{t.value}</strong>;
      case "em":
        return <em key={k}>{t.value}</em>;
      case "code":
        return <code key={k}>{t.value}</code>;
      case "link":
        return (
          <a key={k} href={t.href} target="_blank" rel="noopener noreferrer">
            {t.label}
          </a>
        );
      default:
        return t.value;
    }
  });
}

function renderLine(text: string, keyPrefix: string): ReactNode[] {
  return renderInlineTokens(tokeniseInline(text), keyPrefix);
}

// ── Block parser ─────────────────────────────────────────────────────────────

type Block =
  | { type: "h1" | "h2" | "h3"; text: string; key: string }
  | { type: "ul" | "ol"; items: string[]; key: string }
  | { type: "p"; lines: string[]; key: string };

function parseBlocks(content: string): Block[] {
  const lines = content.split(/\r?\n/);
  const blocks: Block[] = [];
  let lineNum = 0;

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];

    if (/^### /.test(line)) {
      blocks.push({ type: "h3", text: line.slice(4), key: `b-${lineNum++}` });
      i++;
      continue;
    }
    if (/^## /.test(line)) {
      blocks.push({ type: "h2", text: line.slice(3), key: `b-${lineNum++}` });
      i++;
      continue;
    }
    if (/^# /.test(line)) {
      blocks.push({ type: "h1", text: line.slice(2), key: `b-${lineNum++}` });
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      const bk = `b-${lineNum++}`;
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, ""));
        i++;
      }
      blocks.push({ type: "ul", items, key: bk });
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      const bk = `b-${lineNum++}`;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push({ type: "ol", items, key: bk });
      continue;
    }

    // Blank line — skip
    if (line.trim() === "") {
      i++;
      lineNum++;
      continue;
    }

    // Paragraph — collect consecutive non-special lines
    const pLines: string[] = [];
    const bk = `b-${lineNum++}`;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^#{1,3} /.test(lines[i]) &&
      !/^[-*] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i])
    ) {
      pLines.push(lines[i]);
      i++;
    }
    if (pLines.length > 0) {
      blocks.push({ type: "p", lines: pLines, key: bk });
    }
  }

  return blocks;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MuPageRenderer({ content }: MuPageRendererProps) {
  if (!content || content.trim() === "") return null;

  const blocks = parseBlocks(content);

  const rendered: ReactNode[] = blocks.map((block) => {
    switch (block.type) {
      case "h1":
        return <h1 key={block.key}>{renderLine(block.text, block.key)}</h1>;
      case "h2":
        return <h2 key={block.key}>{renderLine(block.text, block.key)}</h2>;
      case "h3":
        return <h3 key={block.key}>{renderLine(block.text, block.key)}</h3>;
      case "ul":
        return (
          <ul key={block.key}>
            {block.items.map((item, j) => (
              <li key={`${block.key}-li-${j}`}>
                {renderLine(item, `${block.key}-li-${j}`)}
              </li>
            ))}
          </ul>
        );
      case "ol":
        return (
          <ol key={block.key}>
            {block.items.map((item, j) => (
              <li key={`${block.key}-li-${j}`}>
                {renderLine(item, `${block.key}-li-${j}`)}
              </li>
            ))}
          </ol>
        );
      case "p": {
        const nodes: ReactNode[] = [];
        block.lines.forEach((ln, j) => {
          if (j > 0) nodes.push(<br key={`${block.key}-br-${j}`} />);
          nodes.push(...renderLine(ln, `${block.key}-ln-${j}`));
        });
        return <p key={block.key}>{nodes}</p>;
      }
    }
  });

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      {rendered}
    </div>
  );
}
