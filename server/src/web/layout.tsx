import type { Child } from "hono/jsx";
import type { User } from "../middleware.js";

interface LayoutProps {
  children: Child;
  user?: User;
  origin?: string;
  title?: string;
  description?: string;
}

export function Layout({
  children,
  user,
  origin = "",
  title = "env-share",
  description = "Self-hosted encrypted .env sharing for teams",
}: LayoutProps) {
  const ogImage = `${origin}/web/og`;
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/basecoat-css@0.3/dist/basecoat.cdn.min.css"
        />
        <script src="https://cdn.jsdelivr.net/npm/basecoat-css@0.3/dist/js/all.min.js" defer />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body class="min-h-screen bg-background text-foreground">
        {user && (
          <nav class="flex items-center justify-between border-b border-border px-4 py-3">
            <a
              href="/web"
              class="flex items-center gap-2 font-semibold no-underline text-foreground"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              env-share
            </a>
            <div class="flex items-center gap-4">
              <span class="text-muted-foreground">{user.github_login}</span>
              <form method="post" action="/web/logout">
                <button class="btn btn-sm btn-ghost" type="submit">
                  Logout
                </button>
              </form>
            </div>
          </nav>
        )}
        <div class="container max-w-screen-xl mx-auto p-8">{children}</div>
      </body>
    </html>
  );
}
