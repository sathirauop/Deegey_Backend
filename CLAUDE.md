# CLAUDE.md

7 Claude rules
1. First think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the [todo.md](http://todo.md/) file with a summary of the changes you made and any other relevant information.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeeGey is a Sri Lankan diaspora matrimonial platform migrating from WordPress to a modern full-stack architecture. This backend repository will contain the Express.js API server that serves both a React web application and existing Flutter mobile app.

## Technology Stack

### Backend Core
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: JavaScript (not TypeScript)
- **Database**: Supabase PostgreSQL 15+
- **Authentication**: JWT tokens with Supabase Auth integration
- **Real-time**: Socket.io 4.7+ for messaging and live updates

### File Handling & Media
- **File Upload**: Multer for handling multipart/form-data
- **Image Processing**: Sharp for resizing, compression, and optimization
- **File Storage**: Supabase Storage with CDN

### Development Tools
- **Code Quality**: ESLint + Prettier
- **Code Review**: CodeRabbit
- **Containerization**: Docker
- **CI/CD**: GitHub Actions

### Client Applications
- **Mobile App**: Existing Flutter app (70% complete)
- **Web App**: Modern React application with comprehensive tech stack (see Frontend Technologies section below)

## Frontend Technologies

### React Web Application

#### Core Framework
* **React 18.2+** - Latest stable version with concurrent features
* **Vite 5.0+** - Ultra-fast build tool (3x faster than Create React App)
* **JavaScript** - ES6+ with modern syntax

#### UI & Styling
* **shadcn/ui** - Modern, accessible React components
* **Tailwind CSS 3.4+** - Utility-first CSS framework
* **Radix UI** - Unstyled, accessible component primitives
* **Lucide React** - Beautiful, customizable SVG icons

#### State Management & Data Fetching
* **React Query (TanStack Query)** - Server state management
* **Redux Toolkit** - Application state management
* **React Hook Form** - Performant form handling with validation

#### Routing & Navigation
* **React Router v7** - Declarative routing with data loading
* **React Router DOM** - Browser history management

#### Development Tools
* **ESLint** - Code linting and quality enforcement
* **Prettier** - Code formatting
* **Husky** - Git hooks for code quality
* **Vitest** - Unit testing framework

#### Production Optimizations
* **Code Splitting** - Route-based lazy loading
* **Tree Shaking** - Dead code elimination
* **Asset Optimization** - Image compression and CDN delivery
* **PWA Support** - Service worker for offline functionality

## Development Commands

When implementing this project, common commands will include:

```bash
# Project setup
npm init -y
npm install express supabase socket.io multer sharp
npm install --save-dev eslint prettier nodemon

# Code quality
npm run lint        # ESLint checking
npm run format      # Prettier formatting
npm run lint:fix    # Auto-fix ESLint issues

# Development
npm run dev         # Start development server with nodemon
npm start          # Start production server

# Docker
docker build -t deegey-backend .
docker run -p 3000:3000 deegey-backend

# Testing
npm test           # Run test suite
npm run test:watch # Run tests in watch mode
```

## Database Schema

The platform uses 33 database entities (28 core + 5 junction tables) including:
- **Core**: User, Profile, ProfilePhoto, ProfileVerification
- **Matching**: Match, SearchFilter, ProfileView, Block, Favorite
- **Communication**: Conversation, Message, MessageAttachment
- **Notifications**: Notification, UserActivity, DeviceToken
- **Family Features**: FamilyMember, FamilyInvitation, Testimonial
- **Admin**: Report, AdminAction, CustomerSupport
- **Reference Data**: Location, Religion, Caste, Education, Occupation

## Development Phases

### Phase 1: Foundation (Weeks 1-2)
1. Authentication System
2. Profile Management
3. Photo Management
4. Admin Dashboard Core

### Phase 2: Core Features (Weeks 3-4)
5. Profile Discovery & Browsing
6. Matching System
7. Real-time Messaging
8. Search & Filtering

### Phase 3: Advanced Features (Weeks 5-6)
9. Notification System
10. Profile Verification
11. Reporting & Moderation
12. Family Features

### Phase 4: Growth Features (Weeks 7-8)
13. Analytics & Insights
14. Premium Features
15. Customer Support System

## Key API Endpoints

Authentication routes (`/api/auth/*`):
- POST /register, /login, /logout, /refresh-token
- POST /forgot-password, /reset-password, /verify-email

Profile management (`/api/profiles/*`):
- GET /me, PUT /me, GET /{id}
- GET /completion-score, PUT /privacy-settings

Matching system (`/api/matches/*`):
- POST /send-interest, GET /received, GET /sent
- PUT /{id}/respond, GET /mutual

Real-time messaging (`/api/conversations/*`):
- GET /, GET /{id}/messages, POST /{id}/messages
- PUT /{id}/read, DELETE /{id}

## Cultural Considerations

This is a matrimonial platform specifically for Sri Lankan diaspora, requiring:
- Complex cultural matching algorithms (religion, caste, language compatibility)
- Family involvement features (family member invitations, testimonials)
- Immigration status and location-based matching
- Traditional values integration with modern UX

## Security Requirements

- JWT access tokens (15min expiry) + refresh tokens (7 days)
- Row-level security policies in Supabase
- Rate limiting (5 login attempts per 15 minutes)
- Input validation/sanitization for all endpoints
- Photo moderation and content filtering
- HTTPS enforcement and CORS configuration

## Real-time Features

Socket.io integration for:
- Instant messaging with typing indicators
- Live match notifications
- Read receipts and delivery status
- Profile view notifications
- Online status indicators

## File Upload Handling

**Multer + Sharp + Supabase Integration**:
- **Multer**: Handle multipart/form-data uploads from clients
- **Sharp**: Process images (resize, compress, format conversion, EXIF removal)
- **Supabase Storage**: Final storage with CDN delivery

Configuration:
- Max file size: 5MB per upload
- Allowed types: JPEG, PNG, WebP
- Auto-resize variants:
  - Large: 800x600px for profile viewing
  - Medium: 400x300px for browsing cards
  - Thumbnail: 150x150px for chat/notifications
- EXIF data removal for privacy protection
- WebP conversion for optimized delivery

## Testing Strategy

- Unit tests for business logic (matching algorithms, profile scoring)
- Integration tests for API endpoints
- Real-time feature testing for Socket.io
- Security testing for authentication flows
- Performance testing for discovery queries

## Deployment Considerations

- Supabase backend handles database, auth, and file storage
- Express.js server deployment with Socket.io support
- Environment-based configuration for dev/staging/prod
- Database migrations and seed data management
- CDN configuration for photo delivery

## Flutter App Integration

The existing Flutter mobile app (70% complete) needs:
- API endpoint updates to use new Express.js server
- Socket.io client integration for real-time features
- New registration flow implementation
- Push notification setup with FCM
- Update existing AuthBloc and state management

## Performance Optimizations

- Database indexing for search queries (age, location, religion)
- Geographic search optimization with PostGIS
- Profile discovery algorithm caching
- CDN for photo delivery
- Connection pooling for database queries

## JavaScript Development Patterns

**Code Style (ESLint + Prettier)**:
- Use ES6+ features (async/await, destructuring, arrow functions)
- JSDoc comments for function documentation
- Consistent error handling with try/catch blocks
- Modular exports/imports (ES6 modules)

**Project Structure**:
```
/src
  /controllers    # Route handlers
  /middleware     # Authentication, validation, error handling
  /services       # Business logic layer
  /utils          # Helper functions
  /config         # Database, auth, storage configuration
  /routes         # Express route definitions
  /models         # Data validation schemas (without ORM)
```

**Error Handling**:
- Custom error classes for different error types
- Centralized error middleware
- Consistent error response format
- Proper HTTP status codes

## Business Logic Patterns

- Profile completion scoring algorithm
- Cultural compatibility matching
- Interest/matching workflow with mutual detection
- Family permission management system
- Verification workflow for profiles and photos

## Code Quality Standards

**ESLint Configuration**:
- Enforce consistent code style
- Prevent common JavaScript pitfalls
- ES6+ syntax rules
- Node.js environment settings

**Prettier Configuration**:
- Consistent formatting across the codebase
- Integration with ESLint for automated formatting
- Pre-commit hooks for code quality assurance