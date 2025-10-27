import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class MastersService {
  private readonly logger = new Logger(MastersService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(city?: string, status?: string) {
    const where: any = {};

    if (city && city !== 'all') {
      where.cities = { has: city };
    }

    if (status && status !== 'all') {
      where.statusWork = status;
    }

    const masters = await this.prisma.master.findMany({
      where,
      select: {
        id: true,
        name: true,
        login: true,
        cities: true,
        statusWork: true,
        dateCreate: true,
        note: true,
        tgId: true,
        chatId: true,
        passportDoc: true,
        contractDoc: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { statusWork: 'asc' },
        { dateCreate: 'desc' },
      ],
    });

    return {
      success: true,
      data: masters,
      total: masters.length,
    };
  }

  async findOne(id: number) {
    if (!id || isNaN(id)) {
      throw new BadRequestException('Invalid master ID');
    }

    const master = await this.prisma.master.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        login: true,
        cities: true,
        statusWork: true,
        dateCreate: true,
        note: true,
        tgId: true,
        chatId: true,
        passportDoc: true,
        contractDoc: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!master) {
      throw new NotFoundException(`Master with ID ${id} not found`);
    }

    return {
      success: true,
      data: master,
    };
  }

  async findByCity(city: string) {
    const masters = await this.prisma.master.findMany({
      where: {
        cities: { has: city },
        statusWork: 'работает',
      },
      select: {
        id: true,
        name: true,
        cities: true,
        tgId: true,
        chatId: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      data: masters,
      total: masters.length,
    };
  }

  async create(createMasterDto: CreateMasterDto) {
    const { password, cities, ...masterData } = createMasterDto;

    // Хэшируем пароль, если предоставлен
    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    const master = await this.prisma.master.create({
      data: {
        ...masterData,
        password: hashedPassword,
        cities: cities || [],
        statusWork: createMasterDto.statusWork || 'работает',
        dateCreate: new Date(),
      },
      select: {
        id: true,
        name: true,
        login: true,
        cities: true,
        statusWork: true,
        dateCreate: true,
        note: true,
        tgId: true,
        chatId: true,
        passportDoc: true,
        contractDoc: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Master created: ${master.name} (ID: ${master.id})`);

    return {
      success: true,
      message: 'Master created successfully',
      data: master,
    };
  }

  async update(id: number, updateMasterDto: UpdateMasterDto) {
    const { password, cities, ...masterData } = updateMasterDto;

    // Проверяем существование мастера
    const existingMaster = await this.prisma.master.findUnique({ where: { id } });
    if (!existingMaster) {
      throw new NotFoundException(`Master with ID ${id} not found`);
    }

    // Подготавливаем данные для обновления
    const updateData: any = {
      ...masterData,
      updatedAt: new Date(),
    };

    // Хэшируем пароль, если предоставлен
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Обновляем города, если предоставлены
    if (cities !== undefined) {
      updateData.cities = cities;
    }

    const master = await this.prisma.master.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        login: true,
        cities: true,
        statusWork: true,
        dateCreate: true,
        note: true,
        tgId: true,
        chatId: true,
        passportDoc: true,
        contractDoc: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Master updated: ${master.name} (ID: ${master.id})`);

    return {
      success: true,
      message: 'Master updated successfully',
      data: master,
    };
  }

  async updateStatus(id: number, status: string) {
    const master = await this.prisma.master.update({
      where: { id },
      data: { statusWork: status },
      select: {
        id: true,
        name: true,
        statusWork: true,
      },
    });

    this.logger.log(`Master status updated: ${master.name} -> ${status}`);

    return {
      success: true,
      message: 'Master status updated',
      data: master,
    };
  }

  async remove(id: number) {
    // Проверяем существование мастера
    const existingMaster = await this.prisma.master.findUnique({ where: { id } });
    if (!existingMaster) {
      throw new NotFoundException(`Master with ID ${id} not found`);
    }

    // Проверяем, есть ли у мастера заказы
    const ordersCount = await this.prisma.order.count({
      where: { masterId: id },
    });

    if (ordersCount > 0) {
      throw new BadRequestException(
        `Cannot delete master with ${ordersCount} orders. Change status to "уволен" instead.`,
      );
    }

    await this.prisma.master.delete({ where: { id } });

    this.logger.log(`Master deleted: ID ${id}`);

    return {
      success: true,
      message: 'Master deleted successfully',
    };
  }

  async getOrdersStats(masterId: number, startDate?: string, endDate?: string) {
    // Проверяем существование мастера
    const master = await this.prisma.master.findUnique({
      where: { id: masterId },
      select: { id: true, name: true, cities: true },
    });

    if (!master) {
      throw new NotFoundException(`Master with ID ${masterId} not found`);
    }

    // Фильтр по датам
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.createDate = {};
      if (startDate) dateFilter.createDate.gte = new Date(startDate);
      if (endDate) dateFilter.createDate.lte = new Date(endDate);
    }

    const [totalOrders, completedOrders, inProgressOrders, revenue] = await Promise.all([
      this.prisma.order.count({
        where: { masterId, ...dateFilter },
      }),
      this.prisma.order.count({
        where: { masterId, statusOrder: 'Закрыт', ...dateFilter },
      }),
      this.prisma.order.count({
        where: {
          masterId,
          statusOrder: { in: ['В работе', 'Назначен мастер', 'Мастер выехал'] },
          ...dateFilter,
        },
      }),
      this.prisma.order.aggregate({
        where: { masterId, result: { not: null }, ...dateFilter },
        _sum: { result: true, clean: true, masterChange: true },
      }),
    ]);

    return {
      success: true,
      data: {
        master: {
          id: master.id,
          name: master.name,
          cities: master.cities,
        },
        orders: {
          total: totalOrders,
          completed: completedOrders,
          inProgress: inProgressOrders,
        },
        revenue: {
          total: Number(revenue._sum.result || 0),
          clean: Number(revenue._sum.clean || 0),
          masterChange: Number(revenue._sum.masterChange || 0),
        },
      },
    };
  }

  async getHandoverSummary() {
    // Получаем всех мастеров с их заказами
    const masters = await this.prisma.master.findMany({
      select: {
        id: true,
        name: true,
        cities: true,
        orders: {
          where: {
            statusOrder: 'Готово',
            // Добавляем фильтр по дате, если нужно
          },
          select: {
            id: true,
            clean: true,
            createDate: true,
          },
        },
      },
    });

    // Группируем данные по мастерам
    const mastersData = masters.map(master => {
      const totalAmount = master.orders.reduce((sum, order) => sum + (order.clean?.toNumber() || 0), 0);
      return {
        id: master.id,
        name: master.name,
        cities: master.cities,
        totalAmount,
        ordersCount: master.orders.length,
      };
    });

    const totalAmount = mastersData.reduce((sum, master) => sum + master.totalAmount, 0);

    return {
      success: true,
      data: {
        masters: mastersData,
        totalAmount,
      },
    };
  }

  async getHandoverDetails(masterId: number) {
    const master = await this.prisma.master.findUnique({
      where: { id: masterId },
      select: {
        id: true,
        name: true,
        cities: true,
        orders: {
          where: {
            statusOrder: 'completed',
          },
          select: {
            id: true,
            clean: true,
            createDate: true,
            city: true,
            rk: true,
          },
        },
      },
    });

    if (!master) {
      throw new NotFoundException('Master not found');
    }

    return {
      success: true,
      data: {
        master: {
          id: master.id,
          name: master.name,
          cities: master.cities,
        },
        orders: master.orders,
      },
    };
  }

  async getProfile(user: any) {
    const masterId = user?.userId;
    
    if (!masterId) {
      throw new Error('Master ID not found in token');
    }

    const master = await this.prisma.master.findUnique({
      where: { id: masterId },
      select: {
        id: true,
        name: true,
        cities: true,
        statusWork: true,
        dateCreate: true,
        note: true,
        tgId: true,
        chatId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!master) {
      throw new NotFoundException('Master not found');
    }

    return {
      success: true,
      data: master,
    };
  }
}

