import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const name = c.req.param('night');
    const night = /^\d{4}-\d{2}-\d{2}$/.test(name) ? readNight(config.runsDir, name) : null;
    if (night === null) {
      return c.html(
        <Layout title="digest" lane={lane()}>
          <h1>digest</h1>
          <p class="mute">{`no run log for ${name}`}</p>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest · ${night.night}`} lane={lane()}>
        <DigestPage night={night} />
      </Layout>,
    );
  });

  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const read = /^\d{4}-\d{2}-\d{2}$/.test(night) ? readNight(config.runsDir, night) : null;
    return read === null ? c.json({ error: 'no run log', night }, 404) : c.json(read);
  });

  return app;
}
