import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CountryDto, PaginatedResponseDto } from '../common/dto/index';
import { CountriesService } from './countries.service';

@ApiTags('countries')
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all countries',
    description: 'Retrieve a list of all countries with optional filtering by continent, region, or search term. Results can be paginated.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of countries per page (max 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'continent',
    required: false,
    enum: ['Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'],
    description: 'Filter countries by continent',
  }) 
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search countries by name or code',
    example: 'france',
  }) 
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved countries',
    type: PaginatedResponseDto<CountryDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  async getCountries(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('continent') continent?: string, 
    @Query('search') search?: string, 
  ): Promise<PaginatedResponseDto<CountryDto>> {
    return this.countriesService.getCountries(
      { continent, search },
      { page, limit },
    );
  }

  @Get(':code')
  @ApiOperation({
    summary: 'Get country by code',
    description: 'Retrieve detailed information about a specific country using its ISO 3166-1 alpha-2 or alpha-3 country code.',
  })
  @ApiParam({
    name: 'code',
    description: 'ISO 3166-1 alpha-2 (e.g., "US") or alpha-3 (e.g., "USA") country code',
    example: 'US',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved country details',
    type: CountryDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Country not found',
  })
  async getCountryByCode(@Param('code') code: string): Promise<CountryDto> {
    return this.countriesService.getCountryByCode(code);
  }

  @Get('continents/list')
  @ApiOperation({
    summary: 'Get list of continents',
    description: 'Retrieve a list of all continents with country counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved continents',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Continents retrieved successfully' },
        timestamp: { type: 'string', example: '2023-10-24T12:00:00.000Z' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Europe' },
              countryCount: { type: 'number', example: 44 },
            },
          },
        },
      },
    },
  })
  async getContinents(): Promise<any> {
    return this.countriesService.getContinents();
  }
}