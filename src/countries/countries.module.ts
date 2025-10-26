import { Module } from '@nestjs/common';
import { CountriesService } from './countries.service';
import { PrismaService } from '../common/prisma.service';
import { CountriesController } from './countries.controller';

@Module({
  controllers: [CountriesController],
  providers: [CountriesService, PrismaService],
  exports: [CountriesService],
})
export class CountriesModule {}