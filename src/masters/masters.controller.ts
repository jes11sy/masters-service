import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MastersService } from './masters.service';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('masters')
@Controller('masters')
export class MastersController {
  constructor(private mastersService: MastersService) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  async health() {
    return {
      success: true,
      message: 'Masters Service is healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get all masters' })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  async findAll(
    @Query('city') city?: string,
    @Query('status') status?: string,
  ) {
    return this.mastersService.findAll(city, status);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master by ID' })
  async findOne(@Param('id') id: string) {
    return this.mastersService.findOne(+id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Create new master' })
  async create(@Body() createMasterDto: CreateMasterDto) {
    return this.mastersService.create(createMasterDto);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Update master' })
  async update(
    @Param('id') id: string,
    @Body() updateMasterDto: UpdateMasterDto,
  ) {
    return this.mastersService.update(+id, updateMasterDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Delete master' })
  async remove(@Param('id') id: string) {
    return this.mastersService.remove(+id);
  }

  @Get(':id/orders')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN, UserRole.MASTER)
  @ApiOperation({ summary: 'Get master orders statistics' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getOrdersStats(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.mastersService.getOrdersStats(+id, startDate, endDate);
  }

  @Get('city/:city')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get masters by city' })
  async findByCity(@Param('city') city: string) {
    return this.mastersService.findByCity(city);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.MASTER)
  @ApiOperation({ summary: 'Get master profile' })
  async getProfile(@Request() req: any) {
    return this.mastersService.getProfile(req.user);
  }

  @Put(':id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Update master status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.mastersService.updateStatus(+id, updateStatusDto.status);
  }

  @Get('handover/summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master handover summary' })
  async getHandoverSummary() {
    return this.mastersService.getHandoverSummary();
  }

  @Get('handover/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master handover details' })
  async getHandoverDetails(@Param('id') id: string) {
    return this.mastersService.getHandoverDetails(+id);
  }
}

