import React from 'react';

function normalizeText(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value === 'object') return value.summary || value.answer || JSON.stringify(value, null, 2);
  return String(value);
}

function renderInline(text, keyPrefix) {
  const parts = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;
    if (token.startsWith('`')) {
      parts.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : text;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseTable(lines, startIndex) {
  if (!lines[startIndex + 1] || !isTableSeparator(lines[startIndex + 1])) return null;

  const tableLines = [lines[startIndex]];
  let index = startIndex + 2;
  while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
    tableLines.push(lines[index]);
    index += 1;
  }

  const rows = tableLines.map((line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()));
  return { rows, nextIndex: index };
}

function flushParagraph(blocks, paragraph, key) {
  if (!paragraph.length) return;
  blocks.push(<p key={key}>{renderInline(paragraph.join(' '), key)}</p>);
  paragraph.length = 0;
}

function flushList(blocks, list, key) {
  if (!list.items.length) return;
  const Tag = list.ordered ? 'ol' : 'ul';
  blocks.push(
    <Tag key={key}>
      {list.items.map((item, index) => <li key={`${key}-${index}`}>{renderInline(item, `${key}-${index}`)}</li>)}
    </Tag>
  );
  list.items = [];
  list.ordered = false;
}

export function MarkdownText({ value, className = '' }) {
  const text = normalizeText(value).trim();
  if (!text) return <p className={className}>No response available.</p>;

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  const paragraph = [];
  const list = { ordered: false, items: [] };
  let codeBlock = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const key = `md-${index}`;

    if (trimmed.startsWith('```')) {
      if (codeBlock) {
        blocks.push(<pre key={key}><code>{codeBlock.join('\n')}</code></pre>);
        codeBlock = null;
      } else {
        flushParagraph(blocks, paragraph, `${key}-p`);
        flushList(blocks, list, `${key}-l`);
        codeBlock = [];
      }
      continue;
    }

    if (codeBlock) {
      codeBlock.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph(blocks, paragraph, `${key}-p`);
      flushList(blocks, list, `${key}-l`);
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      flushParagraph(blocks, paragraph, `${key}-p`);
      flushList(blocks, list, `${key}-l`);
      const [head, ...body] = table.rows;
      blocks.push(
        <div className="ai-markdown-table-wrap" key={key}>
          <table>
            <thead><tr>{head.map((cell, cellIndex) => <th key={`${key}-h-${cellIndex}`}>{renderInline(cell, `${key}-h-${cellIndex}`)}</th>)}</tr></thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={`${key}-r-${rowIndex}`}>
                  {row.map((cell, cellIndex) => <td key={`${key}-c-${rowIndex}-${cellIndex}`}>{renderInline(cell, `${key}-c-${rowIndex}-${cellIndex}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      index = table.nextIndex - 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph(blocks, paragraph, `${key}-p`);
      flushList(blocks, list, `${key}-l`);
      const level = Math.min(heading[1].length + 2, 6);
      const Tag = `h${level}`;
      blocks.push(<Tag key={key}>{renderInline(heading[2], key)}</Tag>);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph(blocks, paragraph, `${key}-p`);
      flushList(blocks, list, `${key}-l`);
      blocks.push(<hr key={key} />);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      flushParagraph(blocks, paragraph, `${key}-p`);
      flushList(blocks, list, `${key}-l`);
      blocks.push(<blockquote key={key}>{renderInline(trimmed.slice(2), key)}</blockquote>);
      continue;
    }

    const unordered = /^[-*]\s+(.+)$/.exec(trimmed);
    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (unordered || ordered) {
      flushParagraph(blocks, paragraph, `${key}-p`);
      const nextOrdered = Boolean(ordered);
      if (list.items.length && list.ordered !== nextOrdered) flushList(blocks, list, `${key}-l`);
      list.ordered = nextOrdered;
      list.items.push((ordered || unordered)[1]);
      continue;
    }

    flushList(blocks, list, `${key}-l`);
    paragraph.push(trimmed);
  }

  flushParagraph(blocks, paragraph, 'md-final-p');
  flushList(blocks, list, 'md-final-l');
  if (codeBlock) blocks.push(<pre key="md-final-code"><code>{codeBlock.join('\n')}</code></pre>);

  return <div className={`ai-markdown ${className}`.trim()}>{blocks}</div>;
}
