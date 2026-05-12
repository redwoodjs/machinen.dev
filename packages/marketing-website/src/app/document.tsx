export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>machinen — Run frontier AI locally</title>
      <meta
        name="description"
        content="Run frontier AI locally. Pause, resume, or fork VMs to run on different hosts. Handoff for VMs."
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
      <link rel="modulepreload" href="/src/client.tsx" />
    </head>
    <body>
      {children}
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
