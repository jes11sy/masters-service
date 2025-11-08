import { Controller, Get, Post, UseGuards, Param, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles, UserRole } from '../auth/roles.guard';
import { MastersService } from '../masters/masters.service';

@ApiTags('Master Handover')
@Controller('master-handover')
export class MasterHandoverController {
  constructor(private readonly mastersService: MastersService) {}

  @Get('summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master handover summary' })
  async getHandoverSummary(@Request() req: any) {
    return this.mastersService.getHandoverSummary(req.user);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Get master handover details' })
  async getHandoverDetails(@Param('id') id: string) {
    return this.mastersService.getHandoverDetails(+id);
  }

  @Post('approve/:orderId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Approve master handover' })
  async approveHandover(@Param('orderId') orderId: string, @Request() req: any) {
    return this.mastersService.approveMasterHandover(+orderId, req.user);
  }

  @Post('reject/:orderId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.DIRECTOR, UserRole.CALLCENTRE_ADMIN)
  @ApiOperation({ summary: 'Reject master handover' })
  async rejectHandover(@Param('orderId') orderId: string, @Request() req: any) {
    return this.mastersService.rejectMasterHandover(+orderId, req.user);
  }
}
