# GoTogether API - Swagger Documentation

This document describes the Swagger/OpenAPI setup for the GoTogether travel planning API.

## 📚 API Documentation

Once the application is running, you can access the interactive API documentation at:
- **Local Development**: http://localhost:3001/api
- **Production**: https://api.gotogether.com/api

## 🚀 Features

### Comprehensive Documentation
- **Auto-generated**: Swagger documentation is automatically generated from code decorators
- **Interactive**: Test API endpoints directly from the browser
- **Type-safe**: Full TypeScript support with proper type definitions

### API Structure
The API is organized into the following modules:

#### Health Check
- `GET /` - Basic health check endpoint

#### Trips Management
- `GET /trips` - Get paginated list of trips with filtering
- `GET /trips/:id` - Get detailed trip information
- `POST /trips` - Create a new trip

#### Activities & Attractions
- `GET /activities` - Search activities by location and filters
- `GET /activities/:id` - Get detailed activity information
- `GET /activities/recommend/:tripId` - Get AI-powered activity recommendations

### Authentication
- **JWT Bearer Token**: All protected endpoints require JWT authentication
- **Persistent Authorization**: Swagger UI remembers your auth token across sessions

### Response Format
All API responses follow a consistent structure:

```json
{
  "success": true,
  "message": "Request completed successfully",
  "timestamp": "2023-10-24T12:00:00.000Z",
  "data": { ... }
}
```

For paginated responses:
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "timestamp": "2023-10-24T12:00:00.000Z",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15,
    "hasNext": true,
    "hasPrev": false
  },
  "data": [...]
}
```

## 🛠️ Development Setup

### Prerequisites
- Node.js (v18+)
- pnpm package manager

### Installation
```bash
# Install dependencies
pnpm install

# Start development server
pnpm run start:dev
```

### Environment Variables
Make sure to set up your environment variables in `.env`:
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/itinerary
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=15m
```

## 📖 Adding New Endpoints

### 1. Create Controller
```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('your-module')
@Controller('your-module')
export class YourController {
  @Get()
  @ApiOperation({
    summary: 'Your endpoint summary',
    description: 'Detailed description of what this endpoint does',
  })
  @ApiResponse({
    status: 200,
    description: 'Success response description',
  })
  yourEndpoint() {
    // Implementation
  }
}
```

### 2. Create DTOs
```typescript
import { ApiProperty } from '@nestjs/swagger';

export class YourDto {
  @ApiProperty({
    description: 'Field description',
    example: 'example value',
  })
  field: string;
}
```

### 3. Register Module
Add your module to `AppModule` imports:
```typescript
@Module({
  imports: [YourModule],
  // ...
})
export class AppModule {}
```

## 🎨 Customization

### Swagger UI Configuration
The Swagger UI is configured in `src/main.ts` with:
- Custom CSS to hide the top bar
- Persistent authorization
- Request duration display
- Collapsible sections by default

### API Information
- **Title**: GoTogether API
- **Description**: Travel planning application API
- **Version**: 1.0
- **Tags**: Organized by feature modules (trips, activities, auth, etc.)

## 🔒 Security

### Authentication
- Bearer token authentication using JWT
- Tokens should be included in the `Authorization` header
- Format: `Bearer <your-jwt-token>`

### CORS Configuration
- Development: All origins allowed
- Production: Restricted to gotogether.com domains

## 📝 Best Practices

1. **Use Descriptive Names**: Make endpoint summaries and descriptions clear
2. **Consistent Response Format**: Follow the established response structure
3. **Proper HTTP Status Codes**: Use appropriate status codes for different scenarios
4. **Input Validation**: Document required fields and validation rules
5. **Error Handling**: Provide clear error messages and codes

## 🚀 Deployment

The Swagger documentation will be automatically available in production at:
`https://your-production-domain/api`

Make sure to update the server URLs in the DocumentBuilder configuration for your production environment.