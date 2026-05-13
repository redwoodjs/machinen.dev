export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Machinen — Hand off a running coding agent between machines</title>
      <meta
        name="description"
        content="Snapshot a Linux VM on one machine, restore it on another. The agent never restarts: same heap, same open files, same timers."
      />
      <meta name="theme-color" content="#09090b" />
      <link
        rel="icon"
        href="/favicon-light.svg"
        media="(prefers-color-scheme: light)"
      />
      <link
        rel="icon"
        href="/favicon-dark.svg"
        media="(prefers-color-scheme: dark)"
      />
      <link rel="alternate" type="text/markdown" href="/index.md" />
      <link rel="stylesheet" href="/src/styles.css?direct" />
      <link rel="modulepreload" href="/src/client.tsx" />
    </head>
    <body>
      {children}
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
