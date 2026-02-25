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
