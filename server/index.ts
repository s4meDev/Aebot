import { createAebotServer } from './app';
import { AebotAnalysisService } from './analysisService';
import { loadServerConfig } from './config';
import { loadLocalEnvironment } from './environment';

const localEnvironmentLoaded = loadLocalEnvironment();
const config = loadServerConfig();
const analysisService = new AebotAnalysisService(config);
const server = createAebotServer({ config, analysisService });

server.listen(config.port, config.host, () => {
  console.info(JSON.stringify({
    event: 'server_started',
    host: config.host,
    port: config.port,
    geminiConfigured: Boolean(config.geminiApiKey),
    localEnvironmentLoaded,
  }));
});

function shutdown(signal: string): void {
  console.info(JSON.stringify({ event: 'server_stopping', signal }));
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
