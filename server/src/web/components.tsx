import type { Child } from "hono/jsx";

export function InlineCode({ children }: { children: Child }) {
  return (
    <code class="inline bg-zinc-950 text-zinc-300 px-1.5 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  );
}

export function Terminal({ commands }: { commands: string[] }) {
  return (
    <div class="rounded-lg bg-zinc-950 text-zinc-300 p-4 font-mono text-sm leading-relaxed">
      {commands.map((cmd) => (
        <div>
          <span class="text-zinc-500">$</span> {cmd}
        </div>
      ))}
    </div>
  );
}
