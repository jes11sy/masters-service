import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

// ==================== КОНСТАНТЫ ====================

const BCRYPT_ROUNDS = 12;

// Статусы мастера
export const MASTER_STATUSES = {
  WORKING: 'работает',
  FIRED: 'уволен',
  VACATION: 'отпуск',
  SICK_LEAVE: 'больничный',
} as const;

export const ALLOWED_MASTER_STATUSES = Object.values(MASTER_STATUSES);

// Статусы заказов
export const ORDER_STATUSES = {
  CLOSED: 'Закрыт',
  IN_PROGRESS: 'В работе',
  ASSIGNED: 'Назначен мастер',
  ON_WAY: 'Мастер выехал',
  READY: 'Готово',
} as const;

// Статусы сдачи наличных
export const CASH_SUBMISSION_STATUSES = {
  NOT_SENT: 'Не отправлено',
  PENDING: 'На проверке',
  APPROVED: 'Одобрено',
  REJECTED: 'Отклонено',
} as const;

// Пагинация
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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
    if (!ALLOWED_MASTER_STATUSES.includes(status as any)) {
      throw new BadRequestException(
        `Недопустимое значение статуса. Допустимые: ${ALLOWED_MASTER_STATUSES.join(', ')}`
      );
    }
  }

  /**
   * Нормализация параметров пагинации
   */
  private normalizePagination(page?: number, limit?: number): { skip: number; take: number; page: number; limit: number } {
    const normalizedPage = Math.max(1, page || DEFAULT_PAGE);
    const normalizedLimit = Math.min(MAX_LIMIT, Math.max(1, limit || DEFAULT_LIMIT));
    return {
      page: normalizedPage,
      limit: normalizedLimit,
      skip: (normalizedPage - 1) * normalizedLimit,
      take: normalizedLimit,
    };
  }

  async findAll(city?: string, status?: string, user?: any, page?: number, limit?: number) {
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

    // Пагинация
    const { skip, take, page: normalizedPage, limit: normalizedLimit } = this.normalizePagination(page, limit);

    // Параллельные запросы для данных и подсчёта
    const [masters, total] = await Promise.all([
      this.prisma.master.findMany({
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
        skip,
        take,
      }),
      this.prisma.master.count({ where }),
    ]);

    this.logger.log(`Retrieved ${masters.length} masters (page: ${normalizedPage}, city: ${city || 'all'}, status: ${status || 'all'})`);

    return {
      success: true,
      data: masters,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages: Math.ceil(total / normalizedLimit),
        hasNext: normalizedPage * normalizedLimit < total,
        hasPrev: normalizedPage > 1,
      },
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
        statusWork: MASTER_STATUSES.WORKING,
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
        statusWork: createMasterDto.statusWork || MASTER_STATUSES.WORKING,
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

  async updateStatus(id: number, status: string, requestUser?: any) {
    // Валидация статуса
    this.validateStatus(status);

    // Проверяем существование мастера
    const existingMaster = await this.prisma.master.findUnique({
      where: { id },
      select: { id: true, name: true, statusWork: true },
    });

    if (!existingMaster) {
      throw new NotFoundException(`Master with ID ${id} not found`);
    }

    const master = await this.prisma.master.update({
      where: { id },
      data: { statusWork: status },
      select: {
        id: true,
        name: true,
        statusWork: true,
      },
    });

    this.logger.log({
      action: 'STATUS_CHANGED',
      masterId: id,
      masterName: master.name,
      oldStatus: existingMaster.statusWork,
      newStatus: status,
      by: requestUser?.userId || 'unknown',
      timestamp: new Date().toISOString(),
    });

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
        `Cannot delete master with ${ordersCount} orders. Change status to "${MASTER_STATUSES.FIRED}" instead.`,
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

    // Оптимизированный запрос с параметризацией (безопасно от SQL Injection)
    const stats = await this.prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status_order = ${ORDER_STATUSES.CLOSED}) as completed_orders,
        COUNT(*) FILTER (WHERE status_order IN (${ORDER_STATUSES.IN_PROGRESS}, ${ORDER_STATUSES.ASSIGNED}, ${ORDER_STATUSES.ON_WAY})) as in_progress_orders,
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

  /**
   * ✅ ИСПРАВЛЕНО: Безопасный запрос без SQL Injection
   */
  async getHandoverSummary(user?: any) {
    // Базовые условия
    const baseConditions = {
      statusOrder: ORDER_STATUSES.READY,
      cashSubmissionStatus: {
        in: [CASH_SUBMISSION_STATUSES.NOT_SENT, CASH_SUBMISSION_STATUSES.PENDING],
      },
    };

    // Фильтр по городам директора
    const cityCondition = (user?.role === 'director' && user?.cities?.length > 0)
      ? { city: { in: user.cities } }
      : {};

    // Безопасный запрос через Prisma ORM (без SQL Injection)
    const ordersWithMasters = await this.prisma.order.groupBy({
      by: ['masterId'],
      where: {
        ...baseConditions,
        ...cityCondition,
        masterId: { not: null },
      },
      _count: { id: true },
      _sum: { clean: true },
    });

    // Получаем информацию о мастерах
    const masterIds = ordersWithMasters
      .map(o => o.masterId)
      .filter((id): id is number => id !== null);

    const masters = await this.prisma.master.findMany({
      where: { id: { in: masterIds } },
      select: { id: true, name: true, cities: true },
    });

    const mastersMap = new Map(masters.map(m => [m.id, m]));

    const mastersData = ordersWithMasters
      .filter(o => o.masterId !== null && mastersMap.has(o.masterId))
      .map(o => {
        const master = mastersMap.get(o.masterId!)!;
        return {
          id: master.id,
          name: master.name,
          cities: master.cities,
          totalAmount: o._sum.clean?.toNumber() || 0,
          ordersCount: o._count.id,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const totalAmount = mastersData.reduce((sum, m) => sum + m.totalAmount, 0);

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
            statusOrder: ORDER_STATUSES.READY,
            cashSubmissionStatus: {
              in: [CASH_SUBMISSION_STATUSES.NOT_SENT, CASH_SUBMISSION_STATUSES.PENDING],
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
      throw new BadRequestException('Director ID not found in token');
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
        cashSubmissionStatus: CASH_SUBMISSION_STATUSES.APPROVED,
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
      throw new BadRequestException('Director ID not found in token');
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
        cashSubmissionStatus: CASH_SUBMISSION_STATUSES.REJECTED,
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
      statusWork: { not: MASTER_STATUSES.FIRED },
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
      const dateStr = s.date.toISOString().slice(0, 10);
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
   * ✅ ОПТИМИЗИРОВАНО: Bulk upsert для расписания
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

    // Оптимизация: используем executeRaw для bulk upsert (PostgreSQL)
    // Это намного эффективнее чем N отдельных upsert операций
    if (days.length > 0) {
      const values = days.map(day => ({
        masterId,
        date: new Date(day.date),
        isWorkDay: day.isWorkDay,
      }));

      // Используем транзакцию с deleteMany + createMany для атомарности
      // Это эффективнее чем N отдельных upsert при больших объёмах
      const dates = values.map(v => v.date);
      
      await this.prisma.$transaction([
        // Удаляем существующие записи за эти даты
        this.prisma.masterSchedule.deleteMany({
          where: {
            masterId,
            date: { in: dates },
          },
        }),
        // Создаём новые записи
        this.prisma.masterSchedule.createMany({
          data: values,
          skipDuplicates: true,
        }),
      ]);
    }

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

  /**
   * Получить всех сотрудников (мастера, директора)
   */
  async getEmployees(query: any, user?: any) {
    const { search, role, page = 1, limit = 50 } = query;
    const { skip, take, page: normalizedPage, limit: normalizedLimit } = this.normalizePagination(page, limit);

    // Валидация поискового запроса
    if (search && search.length > 100) {
      throw new BadRequestException('Search query must not exceed 100 characters');
    }

    // Формируем условие для фильтрации
    const mastersWhere: any = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { login: { contains: search, mode: 'insensitive' } },
      ],
    } : {};

    const directorsWhere: any = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { login: { contains: search, mode: 'insensitive' } },
      ],
    } : {};

    // Для директора показываем только сотрудников его городов
    if (user?.role === 'director' && user?.cities && user.cities.length > 0) {
      mastersWhere.cities = { hasSome: user.cities };
      directorsWhere.cities = { hasSome: user.cities };
    }

    if (role === 'master') {
      const [masters, total] = await Promise.all([
        this.prisma.master.findMany({
          where: mastersWhere,
          skip,
          take,
          select: {
            id: true,
            name: true,
            login: true,
            cities: true,
            statusWork: true,
            dateCreate: true,
            note: true,
          },
          orderBy: { dateCreate: 'desc' },
        }),
        this.prisma.master.count({ where: mastersWhere }),
      ]);

      return {
        success: true,
        data: masters.map(m => ({ ...m, role: 'master' })),
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        totalPages: Math.ceil(total / normalizedLimit),
      };
    }

    if (role === 'director') {
      const [directors, total] = await Promise.all([
        this.prisma.director.findMany({
          where: directorsWhere,
          skip,
          take,
          select: {
            id: true,
            name: true,
            login: true,
            cities: true,
            dateCreate: true,
            note: true,
          },
          orderBy: { dateCreate: 'desc' },
        }),
        this.prisma.director.count({ where: directorsWhere }),
      ]);

      return {
        success: true,
        data: directors.map(d => ({ ...d, role: 'director' })),
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        totalPages: Math.ceil(total / normalizedLimit),
      };
    }

    // Если роль не указана - получаем обоих
    const halfLimit = Math.ceil(normalizedLimit / 2);
    const halfSkip = (normalizedPage - 1) * halfLimit;

    const [masters, directors, mastersCount, directorsCount] = await Promise.all([
      this.prisma.master.findMany({
        where: mastersWhere,
        skip: halfSkip,
        take: halfLimit,
        select: {
          id: true,
          name: true,
          login: true,
          cities: true,
          statusWork: true,
          dateCreate: true,
          note: true,
        },
        orderBy: { dateCreate: 'desc' },
      }),
      this.prisma.director.findMany({
        where: directorsWhere,
        skip: halfSkip,
        take: halfLimit,
        select: {
          id: true,
          name: true,
          login: true,
          cities: true,
          dateCreate: true,
          note: true,
        },
        orderBy: { dateCreate: 'desc' },
      }),
      this.prisma.master.count({ where: mastersWhere }),
      this.prisma.director.count({ where: directorsWhere }),
    ]);

    const total = mastersCount + directorsCount;

    return {
      success: true,
      data: [
        ...masters.map(m => ({ ...m, role: 'master' })),
        ...directors.map(d => ({ ...d, role: 'director' })),
      ],
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages: Math.ceil(total / normalizedLimit),
    };
  }

  /**
   * Обновить документы мастера
   */
  async updateDocuments(id: number, body: { contractDoc?: string; passportDoc?: string }) {
    const master = await this.prisma.master.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!master) {
      throw new NotFoundException(`Master with ID ${id} not found`);
    }

    const updated = await this.prisma.master.update({
      where: { id },
      data: {
        ...(body.contractDoc !== undefined && { contractDoc: body.contractDoc }),
        ...(body.passportDoc !== undefined && { passportDoc: body.passportDoc }),
      },
      select: {
        id: true,
        name: true,
        contractDoc: true,
        passportDoc: true,
      },
    });

    return {
      success: true,
      message: 'Documents updated successfully',
      data: updated,
    };
  }
}
