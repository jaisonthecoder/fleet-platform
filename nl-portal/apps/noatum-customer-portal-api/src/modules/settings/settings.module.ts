import { Module } from '@nestjs/common';

import { SettingsAdminService } from './settings-admin.service';
import { SettingsController } from './settings.controller';

@Module({
  controllers: [SettingsController],
  providers: [SettingsAdminService],
  exports: [SettingsAdminService],
})
export class SettingsModule {}
