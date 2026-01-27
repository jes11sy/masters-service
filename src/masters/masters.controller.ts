import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Request, ParseIntPipe, DefaultValuePipe, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CookieJwtAuthGuard } from '../auth/guards/cookie-jwt-auth.guard';
import { MastersService } from './masters.service';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateScheduleDto } from './dto/schedule.dto';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';

@ApiTags('masters')
@Controller('masters')
export class MastersController {
  constructor(private mastersService: MastersService) {}

  // ==================== СТАТИЧЕСКИЕ МАРШРУТЫ (ДОЛЖНЫ БЫТЬ ПЕРВЫМИ!) ====================

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

  @Get('profile')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.MASTER)
  @ApiOperation({ summary: 'Get master profile' })
  async getProfile(@Request() req: any) {
    return this.mastersService.getProfile(req.user);
  }

  @Get('profile/schedule')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.MASTER)
  @ApiOperation({ summary: 'Get own schedule (for master)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'YYYY-MM-DD' })
  async getOwnSchedule(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.mastersService.getOwnSchedule(req.user, startDate, endDate);
  }

  @Post('profile/schedule')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.MASTER)
  @ApiOperation({ summary: 'Update own schedule (for master)' })
  async updateOwnSchedule(
    @Request() req: any,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.mastersService.updateOwnSchedule(req.user, updateScheduleDto.days);
  }

  @Get('schedules')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get all masters schedules for period (filtered by director cities)' })
  @ApiQuery({ name: 'startDate', required: true, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: true, type: String, description: 'YYYY-MM-DD' })
  async getAllSchedules(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.mastersService.getAllSchedules(req.user, startDate, endDate);
  }

  @Get('employees')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get all employees (masters, directors)' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String, enum: ['master', 'director'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getEmployees(
    @Query() query: any,
    @Request() req: any,
  ) {
    return this.mastersService.getEmployees(query, req.user);
  }

  @Get('handover/summary')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master handover summary' })
  async getHandoverSummary(@Request() req: any) {
    return this.mastersService.getHandoverSummary(req.user);
  }

  @Get('handover/:id')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master handover details' })
  async getHandoverDetails(@Param('id', ParseIntPipe) id: number) {
    return this.mastersService.getHandoverDetails(id);
  }

  @Get('city/:city')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get masters by city' })
  async findByCity(@Param('city') city: string) {
    return this.mastersService.findByCity(city);
  }

  // ==================== CRUD С ПАГИНАЦИЕЙ ====================

  @Get()
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get all masters with pagination' })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50, max: 200)' })
  async findAll(
    @Query('city') city?: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Request() req?: any,
  ) {
    return this.mastersService.findAll(city, status, req.user, page, limit);
  }

  @Post()
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Create new master' })
  async create(@Body() createMasterDto: CreateMasterDto) {
    return this.mastersService.create(createMasterDto);
  }

  // ==================== ДИНАМИЧЕСКИЕ МАРШРУТЫ (ПОСЛЕ СТАТИЧЕСКИХ!) ====================

  @Get(':id')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mastersService.findOne(id);
  }

  @Put(':id')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Update master' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMasterDto: UpdateMasterDto,
    @Request() req: any,
  ) {
    return this.mastersService.update(id, updateMasterDto, req.user);
  }

  @Delete(':id')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Delete master' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.mastersService.remove(id);
  }

  @Get(':id/orders')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN, UserRole.MASTER)
  @ApiOperation({ summary: 'Get master orders statistics' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getOrdersStats(
    @Param('id', ParseIntPipe) id: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.mastersService.getOrdersStats(id, startDate, endDate);
  }

  @Put(':id/status')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Update master status' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
    @Request() req: any,
  ) {
    return this.mastersService.updateStatus(id, updateStatusDto.status, req.user);
  }

  @Get(':id/schedule')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master schedule by ID' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'YYYY-MM-DD' })
  async getSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.mastersService.getSchedule(id, startDate, endDate);
  }

  @Post(':id/schedule')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update master schedule by ID' })
  async updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.mastersService.updateSchedule(id, updateScheduleDto.days);
  }

  @Put(':id/documents')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.MASTER)
  @ApiOperation({ summary: 'Update master documents' })
  async updateDocuments(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() body: { contractDoc?: string; passportDoc?: string },
  ) {
    // Мастер может редактировать только свои документы
    if (req.user.role === UserRole.MASTER && id !== req.user.userId) {
      throw new ForbiddenException('You can only update your own documents');
    }
    return this.mastersService.updateDocuments(id, body);
  }
}
