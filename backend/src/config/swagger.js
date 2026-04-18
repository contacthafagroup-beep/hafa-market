'use strict';
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Hafa Market API',
      version: '1.0.0',
      description: `
## 🌿 Hafa Market — Agricultural E-Commerce API

Africa's premier agricultural marketplace API. Connects farmers and buyers across Ethiopia, Kenya, Ghana, Nigeria, Senegal and 30+ cities.

### Authentication
Use **Bearer token** in the Authorization header:
\`\`\`
Authorization: Bearer <your_access_token>
\`\`\`

### Rate Limits
| Endpoint Group | Limit |
|---|---|
| General API | 100 req / 15 min |
| Auth (login/register) | 20 req / 15 min |
| OTP | 5 req / 10 min |
| Search | 60 req / min |
| Payments | 10 req / 5 min |
| Uploads | 20 req / hour |

### Response Format
All responses follow this structure:
\`\`\`json
{ "success": true, "data": {}, "message": "optional" }
\`\`\`
      `,
      contact: { name: 'Hafa Market Support', email: 'hello@hafamarket.com', url: 'https://hafamarket.com' },
      license: { name: 'MIT' },
    },
    servers: [
      { url: 'http://localhost:5000/api/v1', description: 'Development' },
      { url: 'https://api.hafamarket.com/api/v1', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Something went wrong' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field:   { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Invalid email address' },
                },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page:  { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            pages: { type: 'integer', example: 5 },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:           { type: 'string', format: 'uuid' },
            name:         { type: 'string', example: 'Amina Hassan' },
            email:        { type: 'string', format: 'email' },
            phone:        { type: 'string', example: '+254700000000' },
            role:         { type: 'string', enum: ['BUYER','SELLER','ADMIN','DELIVERY_AGENT'] },
            isVerified:   { type: 'boolean' },
            loyaltyPoints:{ type: 'integer' },
            language:     { type: 'string', enum: ['en','am','om','sw','fr','ar'] },
            createdAt:    { type: 'string', format: 'date-time' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            name:        { type: 'string', example: 'Organic Kale' },
            nameAm:      { type: 'string', example: 'ጎመን' },
            slug:        { type: 'string', example: 'organic-kale-1234567890' },
            price:       { type: 'number', example: 2.49 },
            comparePrice:{ type: 'number', example: 2.99 },
            unit:        { type: 'string', example: 'kg' },
            stock:       { type: 'number', example: 100 },
            images:      { type: 'array', items: { type: 'string', format: 'uri' } },
            isOrganic:   { type: 'boolean' },
            isFeatured:  { type: 'boolean' },
            rating:      { type: 'number', example: 4.8 },
            reviewCount: { type: 'integer', example: 124 },
            status:      { type: 'string', enum: ['ACTIVE','INACTIVE','OUT_OF_STOCK','PENDING_REVIEW'] },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id:         { type: 'string', format: 'uuid' },
            status:     { type: 'string', enum: ['PENDING','CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','REFUNDED'] },
            subtotal:   { type: 'number', example: 15.96 },
            deliveryFee:{ type: 'number', example: 0 },
            discount:   { type: 'number', example: 1.60 },
            total:      { type: 'number', example: 14.36 },
            createdAt:  { type: 'string', format: 'date-time' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id:       { type: 'string', format: 'uuid' },
            name:     { type: 'string', example: 'Vegetables' },
            nameAm:   { type: 'string', example: 'አትክልቶች' },
            slug:     { type: 'string', example: 'vegetables' },
            emoji:    { type: 'string', example: '🥬' },
            children: { type: 'array', items: { type: 'object' } },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Not authenticated',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'Not authorized',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } },
        },
        ValidationError: {
          description: 'Validation failed',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/ValidationError' } } },
        },
      },
    },
    tags: [
      { name: 'Auth',          description: 'Authentication & authorization' },
      { name: 'Users',         description: 'User profile, addresses, wishlist, notifications' },
      { name: 'Products',      description: 'Product catalog management' },
      { name: 'Categories',    description: 'Product categories' },
      { name: 'Cart',          description: 'Shopping cart' },
      { name: 'Orders',        description: 'Order management' },
      { name: 'Payments',      description: 'Payment processing (M-Pesa, Flutterwave, Stripe)' },
      { name: 'Delivery',      description: 'Delivery zones, tracking, agent management' },
      { name: 'Sellers',       description: 'Seller registration, store, analytics' },
      { name: 'Reviews',       description: 'Product reviews & ratings' },
      { name: 'Search',        description: 'Full-text search & autocomplete' },
      { name: 'AI',            description: 'AI assistant, recommendations, image analysis' },
      { name: 'Chat',          description: 'Live support chat' },
      { name: 'Blog',          description: 'Farm blog posts' },
      { name: 'Admin',         description: 'Admin dashboard & management' },
      { name: 'Health',        description: 'Health checks & monitoring' },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

module.exports = swaggerJsdoc(options);
