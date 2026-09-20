import { Fragment, type ReactNode } from "react";

/**
 * Renders CMS page content written with light markup:
 * "## " headings, "- " bullet lines, and blank lines between paragraphs.
 */
export function RichText({ content }: { content: string }) {
  const blocks = content
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .filter((block) => block.trim());

  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
      {blocks.map((block, index) => (
        <Fragment key={index}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}

function renderBlock(block: string): ReactNode {
  const lines = block.split("\n").map((line) => line.trimEnd());
  const first = lines[0] ?? "";

  if (first.startsWith("## ")) {
    const rest = lines.slice(1).join("\n").trim();
    return (
      <>
        <h2 className="pt-4 font-display text-xl font-bold text-foreground">{first.slice(3)}</h2>
        {rest && renderBlock(rest)}
      </>
    );
  }

  if (lines.every((line) => line.trim().startsWith("- "))) {
    return (
      <ul className="list-disc space-y-1.5 ps-5 marker:text-muted-foreground">
        {lines.map((line, index) => (
          <li key={index}>{line.trim().slice(2)}</li>
        ))}
      </ul>
    );
  }

  return <p>{lines.join(" ")}</p>;
}
