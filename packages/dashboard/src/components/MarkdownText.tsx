/**
 * Renders basic markdown (headers, bold, bullets, paragraphs) as React elements.
 * Safe: uses textContent-equivalent rendering, no dangerouslySetInnerHTML.
 */
export function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Headers
    const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const Tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
      const sizes = { 1: "text-sm font-semibold", 2: "text-[13px] font-semibold", 3: "text-xs font-semibold" };
      elements.push(
        <Tag key={i} className={`${sizes[level as 1|2|3]} text-gray-800 mt-2 mb-1`}>
          {headerMatch[2]}
        </Tag>
      );
      continue;
    }

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 my-0.5 ml-2">
          <span className="text-violet-400 shrink-0">&#8226;</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="my-1">
        {renderInline(trimmed)}
      </p>
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}

/** Renders inline markdown: **bold** and `code` */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="bg-gray-100 text-gray-700 px-1 rounded text-[12px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
