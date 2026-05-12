export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>machinen</title>
      <meta
        name="description"
        content="A VM with a single goal: hand off between hosts. Freeze a Linux microVM on one machine, thaw it on another; the process resumes exactly where it left off."
      />
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
