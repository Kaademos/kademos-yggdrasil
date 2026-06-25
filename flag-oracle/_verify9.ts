import { metrics, metricsEnabled } from './src/utils/metrics';
import './src/utils/logger';

const promLoaded = !!require.cache[require.resolve('prom-client')];
const lokiLoaded = !!require.cache[require.resolve('winston-loki')];

(async () => {
  console.log('OBSERVABILITY_ENABLED        =', process.env.OBSERVABILITY_ENABLED ?? '(unset)');
  console.log('metricsEnabled               =', metricsEnabled);
  console.log('prom-client in require.cache =', promLoaded);
  console.log('winston-loki in require.cache=', lokiLoaded);
  console.log('register.contentType         =', metrics.register.contentType);
  metrics.httpRequestsTotal.inc({ method: 'GET', path: '/x', status: '200', service: 'flag-oracle' });
  metrics.flagValidationsTotal.inc({ result: 'success', realm: 'NIFLHEIM' });
  const out = await metrics.getMetrics();
  console.log('getMetrics() first line      =', JSON.stringify(out.split('\n')[0]));
})();
