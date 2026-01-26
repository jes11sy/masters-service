import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';
import { UserRole } from '../auth/roles.guard';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

// Константы для валидации
const BCRYPT_ROUNDS = 12;
const ALLOWED_STATUSES = ['работает', 'уволен', 'отпуск', 'больничный'] as const;

@Injectable()
export class MastersService {
  private readonly logger = new Logger(MastersService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Безопасное хеширование пароля
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /**
   * Валидация допустимого статуса
   */
  private validateStatus(status: string): void {
    if (!ALLOWED_STATUSES.includes(status as any)) {
      throw new BadRequestException(
        `Недопустимое значение статуса. Допустимые: ${ALLOWED_STATUSES.join(', ')}`
      );
    }
  }

  async findAll(city?: string, status?: string, user?: any) {
    // Валидация статуса
    if (status && status !== 'all') {
      this.validateStatus(status);
    }

    const where: Prisma.MasterWhereInput = {};

    // Фильтрация по городам директора
    if (user?.role === 'director' && user?.cities && user.cities.length > 0) {
      where.cities = { hasSome: user.cities };
      
      // Если директор дополнительно фильтрует по конкретному городу из своего списка
      if (city && city !== 'all' && user.cities.includes(city)) {
        where.cities = { has: city };
      }
    } else if (city && city !== 'all') {
      // Для админа можно фильтровать по любому городу
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

    this.logger.log(`Retrieved ${masters.length} masters (city: ${city || 'all'}, status: ${status || 'all'})`);

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
    const { password, cities, login, ...masterData } = createMasterDto;

    // Проверка уникальности логина
    if (login) {
      const existingMaster = await this.prisma.master.findUnique({
        where: { login },
        select: { id: true },
      });
      
      if (existingMaster) {
        throw new BadRequestException(`Логин "${login}" уже используется`);
      }
    }

    // Хэшируем пароль с улучшенным алгоритмом
    const hashedPassword = password ? await this.hashPassword(password) : undefined;

    const master = await this.prisma.master.create({
      data: {
        ...masterData,
        login,
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

    this.logger.log({
      action: 'MASTER_CREATED',
      masterId: master.id,
      name: master.name,
      login: master.login,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Master created successfully',
      data: master,
    };
  }

  async update(id: number, updateMasterDto: UpdateMasterDto, requestUser?: any) {
    const { password, cities, login, ...masterData } = updateMasterDto;

    // Проверяем существование мастера
    const existingMaster = await this.prisma.master.findUnique({ 
      where: { id },
      select: { id: true, login: true, name: true },
    });
    
    if (!existingMaster) {
      throw new NotFoundException(`Master with ID ${id} not found`);
    }

    // Проверка уникальности логина при изменении
    if (login && login !== existingMaster.login) {
      const loginExists = await this.prisma.master.findUnique({
        where: { login },
        select: { id: true },
      });
      
      if (loginExists) {
        throw new BadRequestException(`Логин "${login}" уже используется`);
      }
    }

    // Подготавливаем данные для обновления
    const updateData: Prisma.MasterUpdateInput = {
      ...masterData,
      updatedAt: new Date(),
    };

    // Хэшируем пароль с улучшенным алгоритмом
    if (password) {
      updateData.password = await this.hashPassword(password);
      
      this.logger.warn({
        action: 'PASSWORD_CHANGED',
        masterId: id,
        masterName: existingMaster.name,
        by: requestUser?.userId || 'unknown',
        timestamp: new Date().toISOString(),
      });
    }

    // Обновляем логин
    if (login !== undefined) {
      updateData.login = login;
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

    this.logger.log({
      action: 'MASTER_UPDATED',
      masterId: master.id,
      name: master.name,
      changedFields: Object.keys(updateMasterDto),
      by: requestUser?.userId || 'unknown',
      timestamp: new Date().toISOString(),
    });

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

    // Оптимизированный запрос - один запрос вместо четырех
    const stats = await this.prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status_order = 'Закрыт') as completed_orders,
        COUNT(*) FILTER (WHERE status_order IN ('В работе', 'Назначен мастер', 'Мастер выехал')) as in_progress_orders,
        COALESCE(SUM(result) FILTER (WHERE result IS NOT NULL), 0) as total_revenue,
        COALESCE(SUM(clean) FILTER (WHERE clean IS NOT NULL), 0) as clean_revenue,
        COALESCE(SUM(master_change) FILTER (WHERE master_change IS NOT NULL), 0) as master_change_revenue
      FROM orders
      WHERE master_id = ${masterId}
        ${startDate ? Prisma.sql`AND create_date >= ${new Date(startDate)}::timestamp` : Prisma.empty}
        ${endDate ? Prisma.sql`AND create_date <= ${new Date(endDate)}::timestamp` : Prisma.empty}
    `;

    const stat = stats[0];

    return {
      success: true,
      data: {
        master: {
          id: master.id,
          name: master.name,
          cities: master.cities,
        },
        orders: {
          total: parseInt(stat.total_orders),
          completed: parseInt(stat.completed_orders),
          inProgress: parseInt(stat.in_progress_orders),
        },
        revenue: {
          total: parseFloat(stat.total_revenue).toFixed(2),
          clean: parseFloat(stat.clean_revenue).toFixed(2),
          masterChange: parseFloat(stat.master_change_revenue).toFixed(2),
        },
      },
    };
  }

  async getHandoverSummary(user?: any) {
    // Фильтрация по городам директора
    let cityFilter = '';
    if (user?.role === 'director' && user?.cities && Array.isArray(user.cities) && user.cities.length > 0) {
      const cities = user.cities.map((city: string) => `'${city.replace(/'/g, "''")}'`).join(', ');
      cityFilter = `AND o.city IN (${cities})`;
    }

    // Оптимизированный запрос - агрегация на стороне БД
    const query = `
      SELECT 
        m.id,
        m.name,
        m.cities,
        COUNT(o.id) as "ordersCount",
        COALESCE(SUM(o.clean), 0) as "totalAmount"
      FROM master m
      LEFT JOIN orders o ON o.master_id = m.id
        AND o.status_order = 'Готово'
        AND o.cash_submission_status IN ('Не отправлено', 'На проверке')
        ${cityFilter}
      GROUP BY m.id, m.name, m.cities
      HAVING COUNT(o.id) > 0
      ORDER BY m.name
    `;

    const aggregatedData = await this.prisma.$queryRawUnsafe<any[]>(query);

    const mastersData = aggregatedData.map(m => ({
      id: m.id,
      name: m.name,
      cities: m.cities,
      totalAmount: parseFloat(m.totalAmount),
      ordersCount: parseInt(m.ordersCount),
    }));

    const totalAmount = mastersData.reduce(
      (sum, master) => sum + master.totalAmount, 
      0
    );

    return {
      success: true,
      data: {
        masters: mastersData,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
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
            statusOrder: 'Готово',
            cashSubmissionStatus: {
              in: ['Не отправлено', 'На проверке'],
            },
          },
          select: {
            id: true,
            address: true,
            problem: true,
            result: true,
            masterChange: true,
            cashSubmissionStatus: true,
            cashReceiptDoc: true,
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
        orders: master.orders.map(order => ({
          ...order,
          masterName: master.name,
        })),
      },
    };
  }

  async getProfile(user: any) {
    const masterId = user?.userId;
    
    if (!masterId) {
      throw new BadRequestException('Master ID not found in token');
    }

    // Проверяем, что пользователь запрашивает свой собственный профиль
    if (user.role === UserRole.MASTER && user.userId !== masterId) {
      this.logger.warn({
        action: 'UNAUTHORIZED_PROFILE_ACCESS',
        userId: user.userId,
        attemptedAccessTo: masterId,
        timestamp: new Date().toISOString(),
      });
      throw new ForbiddenException('Вы можете просматривать только свой профиль');
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

    this.logger.log({
      action: 'PROFILE_ACCESSED',
      masterId: master.id,
      by: user.userId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      data: master,
    };
  }

  async approveMasterHandover(orderId: number, user: any) {
    const directorId = user?.userId;

    if (!directorId) {
      throw new Error('Director ID not found in token');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        cashSubmissionStatus: 'Одобрено',
        cashApprovedBy: directorId,
        cashApprovedDate: new Date(),
      },
    });

    return {
      success: true,
      message: 'Сдача мастера одобрена',
    };
  }

  async rejectMasterHandover(orderId: number, user: any) {
    const directorId = user?.userId;

    if (!directorId) {
      throw new Error('Director ID not found in token');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        cashSubmissionStatus: 'Отклонено',
        cashApprovedBy: directorId,
        cashApprovedDate: new Date(),
      },
    });

    return {
      success: true,
      message: 'Сдача мастера отклонена',
    };
  }

  // ==================== SCHEDULE METHODS ====================

  /**
   * Получить расписание всех мастеров за период (с фильтрацией по городам директора)
   */
  async getAllSchedules(user: any, startDate: string, endDate: string) {
    // Фильтр по городам директора
    const where: Prisma.MasterWhereInput = {
      statusWork: { not: 'уволен' }, // Исключаем уволенных
    };

    // Если директор - фильтруем по его городам
    if (user?.role === 'director' && user?.cities && user.cities.length > 0) {
      where.cities = { hasSome: user.cities };
    }

    // Получаем мастеров
    const masters = await this.prisma.master.findMany({
      where,
      select: {
        id: true,
        name: true,
        statusWork: true,
        cities: true,
      },
      orderBy: { name: 'asc' },
    });

    // Получаем расписание для всех мастеров за период одним запросом
    const masterIds = masters.map(m => m.id);
    
    const schedules = await this.prisma.masterSchedule.findMany({
      where: {
        masterId: { in: masterIds },
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        masterId: true,
        date: true,
        isWorkDay: true,
      },
    });

    // Группируем расписание по мастерам
    const scheduleMap = new Map<number, { date: string; isWorkDay: boolean }[]>();
    schedules.forEach(s => {
      const dateStr = s.date.toISOString().split('T')[0];
      if (!scheduleMap.has(s.masterId)) {
        scheduleMap.set(s.masterId, []);
      }
      scheduleMap.get(s.masterId)!.push({ date: dateStr, isWorkDay: s.isWorkDay });
    });

    return {
      success: true,
      data: {
        masters: masters.map(m => ({
          id: m.id,
          name: m.name,
          statusWork: m.statusWork,
          cities: m.cities,
          schedule: scheduleMap.get(m.id) || [],
        })),
        period: { startDate, endDate },
      },
    };
  }

  /**
   * Получить расписание мастера за период
   */
  async getSchedule(masterId: number, startDate?: string, endDate?: string) {
    // Проверяем существование мастера
    const master = await this.prisma.master.findUnique({
      where: { id: masterId },
      select: { id: true, name: true },
    });

    if (!master) {
      throw new NotFoundException(`Master with ID ${masterId} not found`);
    }

    const where: Prisma.MasterScheduleWhereInput = {
      masterId,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    const schedule = await this.prisma.masterSchedule.findMany({
      where,
      select: {
        id: true,
        date: true,
        isWorkDay: true,
      },
      orderBy: { date: 'asc' },
    });

    return {
      success: true,
      data: {
        masterId,
        masterName: master.name,
        schedule: schedule.map(s => ({
          date: s.date.toISOString().split('T')[0],
          isWorkDay: s.isWorkDay,
        })),
      },
    };
  }

  /**
   * Обновить расписание мастера (upsert - создать или обновить)
   */
  async updateSchedule(masterId: number, days: { date: string; isWorkDay: boolean }[]) {
    // Проверяем существование мастера
    const master = await this.prisma.master.findUnique({
      where: { id: masterId },
      select: { id: true, name: true },
    });

    if (!master) {
      throw new NotFoundException(`Master with ID ${masterId} not found`);
    }

    // Используем транзакцию для атомарного обновления
    const upsertPromises = days.map(day => 
      this.prisma.masterSchedule.upsert({
        where: {
          masterId_date: {
            masterId,
            date: new Date(day.date),
          },
        },
        create: {
          masterId,
          date: new Date(day.date),
          isWorkDay: day.isWorkDay,
        },
        update: {
          isWorkDay: day.isWorkDay,
        },
      })
    );

    await this.prisma.$transaction(upsertPromises);

    this.logger.log({
      action: 'SCHEDULE_UPDATED',
      masterId,
      masterName: master.name,
      daysCount: days.length,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Расписание обновлено',
      data: {
        masterId,
        updatedDays: days.length,
      },
    };
  }

  /**
   * Получить своё расписание (для мастера)
   */
  async getOwnSchedule(user: any, startDate?: string, endDate?: string) {
    const masterId = user?.userId;
    
    if (!masterId) {
      throw new BadRequestException('Master ID not found in token');
    }

    return this.getSchedule(masterId, startDate, endDate);
  }

  /**
   * Обновить своё расписание (для мастера)
   */
  async updateOwnSchedule(user: any, days: { date: string; isWorkDay: boolean }[]) {
    const masterId = user?.userId;
    
    if (!masterId) {
      throw new BadRequestException('Master ID not found in token');
    }

    return this.updateSchedule(masterId, days);
  }
}

