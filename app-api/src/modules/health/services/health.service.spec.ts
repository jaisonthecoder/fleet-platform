import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports the requested service as healthy', () => {
    const result = new HealthService().getStatus('api');

    expect(result.status).toBe('ok');
    expect(result.service).toBe('api');
    expect(Date.parse(result.timestamp)).not.toBeNaN();
  });
});
