/**
 * Dev-server-only hook that lets the in-game dev panel save its slider values
 * straight into src/config/tuning.ts. It only exists while `npm run dev` is
 * running; the deployed game has no way to write files.
 */
import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { rewriteTuningSource } from '../src/dev/tuningFile.ts';

export function devSaveTuningPlugin(): Plugin {
  return {
    name: 'rebound-dev-save-tuning',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/save-tuning', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const values = JSON.parse(body) as Record<string, number>;
            const file = path.resolve(server.config.root, 'src/config/tuning.ts');
            const { text, changed } = rewriteTuningSource(fs.readFileSync(file, 'utf8'), values);
            if (changed > 0) fs.writeFileSync(file, text);
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ changed }));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
    },
  };
}
