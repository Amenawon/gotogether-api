import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../common/prisma.service';
import { CountryDto } from '../common/dto/country.dto';
import { PaginatedResponseDto, PaginationMetaDto } from '../common/dto/base-response.dto';

interface CountryFilters {
  continent?: string;
  region?: string;
  search?: string; 
}

interface PaginationOptions {
  page: number;
  limit: number;
}

@Injectable()
export class CountriesService {
  private readonly logger = new Logger(CountriesService.name);
  private readonly CACHE_KEYS = {
    ALL_COUNTRIES: 'countries:all',
    COUNTRY_BY_CODE: 'country:code:',
    CONTINENTS: 'countries:continents',
    POPULAR_COUNTRIES: 'countries:popular',
  };
  private readonly CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getCountries(
    filters: CountryFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedResponseDto<CountryDto>> {
    const { page, limit } = pagination;
    const { continent, region, search } = filters;

    // If database is not connected, return fallback data
    if (!this.prisma.isDbConnected()) {
      return this.getFallbackCountries(filters, pagination);
    }

    // Create cache key based on filters and pagination
    const cacheKey = `countries:filtered:${JSON.stringify({ filters, pagination })}`;

    try {
      // Try to get from cache first
      const cached = await this.cacheManager.get<PaginatedResponseDto<CountryDto>>(cacheKey);
      if (cached) {
        this.logger.debug(`Countries retrieved from cache: ${cacheKey}`);
        return cached;
      }

      // Build where clause for Prisma
      const where: any = {};

      if (continent) {
        where.continent = {
          equals: continent,
          mode: 'insensitive',
        };
      }

      if (region) {
        where.region = {
          contains: region,
          mode: 'insensitive',
        };
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { code3: { contains: search, mode: 'insensitive' } },
        ];
      }
      // Get total count for pagination
      const total = await this.prisma.country.count({ where });

      // Get paginated results
      const countries = await this.prisma.country.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      });

      // Transform to DTOs
      const countryDtos: CountryDto[] = countries.map(this.transformToDto);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const meta: PaginationMetaDto = {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };

      const result: PaginatedResponseDto<CountryDto> = {
        success: true,
        message: 'Countries retrieved successfully',
        timestamp: new Date().toISOString(),
        meta,
        data: countryDtos,
      };

      // Cache the result
      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
      this.logger.debug(`Countries cached with key: ${cacheKey}`);

      return result;
    } catch (error) {
      this.logger.error(`Error retrieving countries: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getCountryByCode(code: string): Promise<CountryDto> {
    const cacheKey = `${this.CACHE_KEYS.COUNTRY_BY_CODE}${code.toUpperCase()}`;

    try {
      // Try cache first
      const cached = await this.cacheManager.get<CountryDto>(cacheKey);
      if (cached) {
        this.logger.debug(`Country retrieved from cache: ${cacheKey}`);
        return cached;
      }

      // If database is not connected, use fallback data
      if (!this.prisma.isDbConnected()) {
        return this.getFallbackCountryByCode(code);
      }

      // Query database
      const country = await this.prisma.country.findFirst({
        where: {
          OR: [
            { code: { equals: code.toUpperCase(), mode: 'insensitive' } },
            { code3: { equals: code.toUpperCase(), mode: 'insensitive' } },
          ],
        },
      });

      if (!country) {
        throw new NotFoundException(`Country with code '${code}' not found`);
      }

      const countryDto = this.transformToDto(country);

      // Cache the result
      await this.cacheManager.set(cacheKey, countryDto, this.CACHE_TTL);
      this.logger.debug(`Country cached with key: ${cacheKey}`);

      return countryDto;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error retrieving country by code ${code}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getContinents(): Promise<any> {
    try {
      // Try cache first
      const cached = await this.cacheManager.get(this.CACHE_KEYS.CONTINENTS);
      if (cached) {
        this.logger.debug('Continents retrieved from cache');
        return {
          success: true,
          message: 'Continents retrieved successfully',
          timestamp: new Date().toISOString(),
          data: cached,
        };
      }

      // If database is not connected, use fallback data
      if (!this.prisma.isDbConnected()) {
        return this.getFallbackContinents();
      }

      // Query database for continent counts
      const continents = await this.prisma.country.groupBy({
        by: ['continent'],
        _count: {
          continent: true,
        },
        orderBy: {
          continent: 'asc',
        },
      });

      const continentData = continents.map(c => ({
        name: c.continent,
        countryCount: c._count.continent,
      }));

      // Cache the result
      await this.cacheManager.set(this.CACHE_KEYS.CONTINENTS, continentData, this.CACHE_TTL);
      this.logger.debug('Continents cached successfully');

      return {
        success: true,
        message: 'Continents retrieved successfully',
        timestamp: new Date().toISOString(),
        data: continentData,
      };
    } catch (error) {
      this.logger.error(`Error retrieving continents: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAllCountries(): Promise<CountryDto[]> {
    try {
      // Try cache first
      const cached = await this.cacheManager.get<CountryDto[]>(this.CACHE_KEYS.ALL_COUNTRIES);
      if (cached) {
        this.logger.debug('All countries retrieved from cache');
        return cached;
      }

      // Query database
      const countries = await this.prisma.country.findMany({
        orderBy: { name: 'asc' },
      });

      const countryDtos = countries.map(this.transformToDto);

      // Cache the result
      await this.cacheManager.set(this.CACHE_KEYS.ALL_COUNTRIES, countryDtos, this.CACHE_TTL);
      this.logger.debug('All countries cached successfully');

      return countryDtos;
    } catch (error) {
      this.logger.error(`Error retrieving all countries: ${error.message}`, error.stack);
      throw error;
    }
  }

  async invalidateCache(): Promise<void> {
    try {
      // Clear all country-related cache entries
      await Promise.all([
        this.cacheManager.del(this.CACHE_KEYS.ALL_COUNTRIES),
        this.cacheManager.del(this.CACHE_KEYS.CONTINENTS),
        this.cacheManager.del(this.CACHE_KEYS.POPULAR_COUNTRIES),
      ]);

      // Note: Individual country cache keys and filtered results would need more sophisticated clearing
      // In a production environment, you might use cache tags or patterns for better cache management
      
      this.logger.log('Country cache invalidated successfully');
    } catch (error) {
      this.logger.error(`Error invalidating cache: ${error.message}`, error.stack);
      throw error;
    }
  }

  private transformToDto(country: any): CountryDto {
    return {
      code: country.code,
      code3: country.code3,
      name: country.name,
      officialName: country.officialName,
      capital: country.capital,
      continent: country.continent,
      region: country.region,
      languages: country.languages,
      currencies: country.currencies,
      callingCodes: country.callingCodes,
      isPopularDestination: country.isPopularDestination,
      flag: country.flag,
      latitude: country.latitude,
      longitude: country.longitude,
    };
  }

  // Fallback methods for when database is not available
  private getFallbackCountries(
    filters: CountryFilters,
    pagination: PaginationOptions,
  ): PaginatedResponseDto<CountryDto> {
    this.logger.warn('Using fallback countries data - database not connected');
    
    let filteredCountries = [...this.getFallbackCountryData()];

    // Apply filters
    if (filters.continent) {
      filteredCountries = filteredCountries.filter(country => 
        country.continent.toLowerCase() === filters.continent!.toLowerCase()
      );
    }

    if (filters.region) {
      filteredCountries = filteredCountries.filter(country => 
        country.region.toLowerCase().includes(filters.region!.toLowerCase())
      );
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredCountries = filteredCountries.filter(country => 
        country.name.toLowerCase().includes(searchTerm) ||
        country.code.toLowerCase().includes(searchTerm) ||
        country.code3.toLowerCase().includes(searchTerm)
      );
    }

    // Pagination
    const total = filteredCountries.length;
    const totalPages = Math.ceil(total / pagination.limit);
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    const paginatedCountries = filteredCountries.slice(startIndex, endIndex);

    return {
      success: true,
      message: 'Countries retrieved successfully (fallback data)',
      timestamp: new Date().toISOString(),
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
      data: paginatedCountries,
    };
  }

  private getFallbackCountryData(): CountryDto[] {
    return [
      {
        code: 'US',
        code3: 'USA',
        name: 'United States',
        officialName: 'United States of America',
        capital: 'Washington, D.C.',
        continent: 'North America',
        region: 'Northern America',
        languages: ['English'],
        currencies: ['USD'],
        callingCodes: ['+1'],
        isPopularDestination: true,
        flag: '🇺🇸',
        latitude: 39.8283,
        longitude: -98.5795,
      },
      {
        code: 'CA',
        code3: 'CAN',
        name: 'Canada',
        officialName: 'Canada',
        capital: 'Ottawa',
        continent: 'North America',
        region: 'Northern America',
        languages: ['English', 'French'],
        currencies: ['CAD'],
        callingCodes: ['+1'],
        isPopularDestination: true,
        flag: '🇨🇦',
        latitude: 56.1304,
        longitude: -106.3468,
      },
      {
        code: 'GB',
        code3: 'GBR',
        name: 'United Kingdom',
        officialName: 'United Kingdom of Great Britain and Northern Ireland',
        capital: 'London',
        continent: 'Europe',
        region: 'Northern Europe',
        languages: ['English'],
        currencies: ['GBP'],
        callingCodes: ['+44'],
        isPopularDestination: true,
        flag: '🇬🇧',
        latitude: 55.3781,
        longitude: -3.4360,
      },
      {
        code: 'FR',
        code3: 'FRA',
        name: 'France',
        officialName: 'French Republic',
        capital: 'Paris',
        continent: 'Europe',
        region: 'Western Europe',
        languages: ['French'],
        currencies: ['EUR'],
        callingCodes: ['+33'],
        isPopularDestination: true,
        flag: '🇫🇷',
        latitude: 46.2276,
        longitude: 2.2137,
      },
      {
        code: 'DE',
        code3: 'DEU',
        name: 'Germany',
        officialName: 'Federal Republic of Germany',
        capital: 'Berlin',
        continent: 'Europe',
        region: 'Western Europe',
        languages: ['German'],
        currencies: ['EUR'],
        callingCodes: ['+49'],
        isPopularDestination: true,
        flag: '🇩🇪',
        latitude: 51.1657,
        longitude: 10.4515,
      },
      {
        code: 'JP',
        code3: 'JPN',
        name: 'Japan',
        officialName: 'Japan',
        capital: 'Tokyo',
        continent: 'Asia',
        region: 'Eastern Asia',
        languages: ['Japanese'],
        currencies: ['JPY'],
        callingCodes: ['+81'],
        isPopularDestination: true,
        flag: '🇯🇵',
        latitude: 36.2048,
        longitude: 138.2529,
      },
      {
        code: 'AU',
        code3: 'AUS',
        name: 'Australia',
        officialName: 'Commonwealth of Australia',
        capital: 'Canberra',
        continent: 'Oceania',
        region: 'Australia and New Zealand',
        languages: ['English'],
        currencies: ['AUD'],
        callingCodes: ['+61'],
        isPopularDestination: true,
        flag: '🇦🇺',
        latitude: -25.2744,
        longitude: 133.7751,
      },
    ];
  }

  private getFallbackCountryByCode(code: string): CountryDto {
    this.logger.warn(`Using fallback country data for code: ${code} - database not connected`);
    
    const countries = this.getFallbackCountryData();
    const country = countries.find(c => 
      c.code.toLowerCase() === code.toLowerCase() || 
      c.code3.toLowerCase() === code.toLowerCase()
    );

    if (!country) {
      throw new NotFoundException(`Country with code '${code}' not found`);
    }

    return country;
  }

  private getFallbackContinents(): any {
    this.logger.warn('Using fallback continents data - database not connected');
    
    const countries = this.getFallbackCountryData();
    const continentCounts = new Map<string, number>();
    
    countries.forEach(country => {
      const count = continentCounts.get(country.continent) || 0;
      continentCounts.set(country.continent, count + 1);
    });

    const continentData = Array.from(continentCounts.entries()).map(([name, countryCount]) => ({
      name,
      countryCount,
    })).sort((a, b) => a.name.localeCompare(b.name));

    return {
      success: true,
      message: 'Continents retrieved successfully (fallback data)',
      timestamp: new Date().toISOString(),
      data: continentData,
    };
  }
}