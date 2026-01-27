import { Controller, Get, Post, UseGuards, Param, Request, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CookieJwtAuthGuard } from '../auth/guards/cookie-jwt-auth.guard';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';
import { MastersService } from '../masters/masters.service';

@ApiTags('Master Handover')
@Controller('master-handover')
export class MasterHandoverController {
  constructor(private readonly mastersService: MastersService) {}

  @Get('summary')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master handover summary' })
  async getHandoverSummary(@Request() req: any) {
    return this.mastersService.getHandoverSummary(req.user);
  }

  // ✅ FIX: Добавлена валидация ParseIntPipe для предотвращения ошибок при невалидном ID
  @Get(':id')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master handover details' })
  async getHandoverDetails(@Param('id', ParseIntPipe) id: number) {
    return this.mastersService.getHandoverDetails(id);
  }

  // ✅ FIX: Добавлена валидация ParseIntPipe для предотвращения ошибок при невалидном orderId
  @Post('approve/:orderId')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Approve master handover' })
  async approveHandover(@Param('orderId', ParseIntPipe) orderId: number, @Request() req: any) {
    return this.mastersService.approveMasterHandover(orderId, req.user);
  }

  // ✅ FIX: Добавлена валидация ParseIntPipe для предотвращения ошибок при невалидном orderId
  @Post('reject/:orderId')
  @UseGuards(CookieJwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Reject master handover' })
  async rejectHandover(@Param('orderId', ParseIntPipe) orderId: number, @Request() req: any) {
    return this.mastersService.rejectMasterHandover(orderId, req.user);
  }
}
