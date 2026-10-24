import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);

createApp().listen(port, (error) => {
  if (error) {
    console.error(`Could not start the API on port ${port}: ${error.message}`);
    process.exit(1);
  }
  console.log(`API listening on http://localhost:${port}`);
});
