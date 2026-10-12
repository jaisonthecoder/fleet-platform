import { Module } from '@nestjs/common';

import { PortsController } from './ports.controller';
import { PortsService } from './ports.service';

/**
 * The port directory. Nothing else depends on it: a quote stores the code and the
 * name it was given as its own text, so no module needs to resolve one.
 */
@Module({
  controllers: [PortsController],
  providers: [PortsService],
  exports: [PortsService],
})
export class PortsModule {}
