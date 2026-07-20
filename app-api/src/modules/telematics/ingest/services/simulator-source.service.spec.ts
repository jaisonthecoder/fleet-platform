import { SimulatorSourceService } from './simulator-source.service';

describe('SimulatorSourceService', () => {
  it('emits a canonical point immediately', () => {
    const source = new SimulatorSourceService();
    const batches: unknown[] = [];

    source.start((points) => batches.push(points));
    source.stop();

    expect(batches).toHaveLength(1);
  });
});
