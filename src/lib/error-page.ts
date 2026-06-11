export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>DEADSET</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <style>
      body { background: #0a0a0a; color: #f5f5f0; font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 24rem; width: 100%; text-align: center; }
      h1 { font-size: 1.1rem; margin: 0 0 0.5rem; letter-spacing: .05em; text-transform: uppercase; }
      p { color: #8a8a8a; font-size: .85rem; margin: 0 0 1.5rem; line-height: 1.5; }
      .actions { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; }
      button, a { padding: .5rem 1.25rem; font: inherit; cursor: pointer; text-decoration: none; border: none; font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
      .primary { background: #e63222; color: #fff; }
      .secondary { background: transparent; color: #f5f5f0; border: 1px solid #2e2e2e; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Something went wrong</h1>
      <p>We hit an error on our end. Try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
