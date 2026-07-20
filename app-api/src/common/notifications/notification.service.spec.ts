import type { NotificationMessage, NotificationPort } from './notification.port';
import { NotificationService } from './notification.service';

/** Records delivered messages; can be told to fail to test the failure path. */
class FakeTransport implements NotificationPort {
  readonly delivered: NotificationMessage[] = [];
  shouldFail = false;
  async deliver(message: NotificationMessage): Promise<void> {
    if (this.shouldFail) {
      throw new Error('transport down');
    }
    this.delivered.push(message);
  }
}

const compliance: NotificationMessage = {
  category: 'compliance',
  channel: 'email',
  toRef: 'person:1',
  subject: 'Insurance expiring',
  body: 'Renew now',
};
const operational: NotificationMessage = {
  category: 'operational',
  channel: 'push',
  toRef: 'person:1',
  subject: 'Booking reminder',
  body: 'Pick up at 09:00',
};

describe('NotificationService', () => {
  it('delivers a message via the transport', async () => {
    const transport = new FakeTransport();
    const service = new NotificationService(transport);
    expect(await service.send(operational)).toBe('delivered');
    expect(transport.delivered).toHaveLength(1);
  });

  it('suppresses a muted operational message', async () => {
    const transport = new FakeTransport();
    const service = new NotificationService(transport);
    expect(await service.send(operational, true)).toBe('suppressed');
    expect(transport.delivered).toHaveLength(0);
  });

  it('delivers a compliance message even when muted (unmutable policy floor)', async () => {
    const transport = new FakeTransport();
    const service = new NotificationService(transport);
    expect(await service.send(compliance, true)).toBe('delivered');
    expect(transport.delivered).toHaveLength(1);
  });

  it('reports a transport failure without throwing', async () => {
    const transport = new FakeTransport();
    transport.shouldFail = true;
    const service = new NotificationService(transport);
    await expect(service.send(compliance)).resolves.toBe('failed');
  });
});
