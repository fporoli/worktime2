import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DateRangeQueryDto } from '../common/date-range-query.dto';
import { AppUser } from '../users/entities/app-user.entity';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { TimeEntriesService } from './time-entries.service';

@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Get()
  list(@CurrentUser() user: AppUser, @Query() query: DateRangeQueryDto) {
    return this.timeEntriesService.listMine(user, query.from, query.to);
  }

  @Post()
  create(@CurrentUser() user: AppUser, @Body() dto: CreateTimeEntryDto) {
    return this.timeEntriesService.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AppUser, @Param('id') id: string, @Body() dto: UpdateTimeEntryDto) {
    return this.timeEntriesService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AppUser, @Param('id') id: string) {
    return this.timeEntriesService.remove(user, id);
  }
}
