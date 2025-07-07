const request = require('supertest');
const app = require('../../../src/app');
const SupabaseMock = require('../../setup/supabaseMock');
const AuthHelpers = require('../../helpers/authHelpers');

describe('Profile - Completion Flow', () => {
  let supabaseMock;
  let authHelpers;

  beforeEach(() => {
    supabaseMock = new SupabaseMock();
    authHelpers = new AuthHelpers(app);
    supabaseMock.setupDefaultMocks();
  });

  afterEach(() => {
    supabaseMock.clearMocks();
  });

  describe('Complete Profile', () => {
    test('should successfully complete profile when sufficient completion percentage', async () => {
      const userData = authHelpers.generateValidUser();
      const mockProfile = {
        id: 'profile_123',
        user_id: userData.id,
        completion_percentage: 75,
        is_complete: false,
        marital_status: 'single',
        education: 'bachelors',
        occupation: 'engineer',
        height: 175,
        mother_tongue: 'english'
      };

      // Mock authenticated user and profile
      supabaseMock.mockAuthenticatedUser(userData);
      supabaseMock.mockProfileFind(mockProfile);
      supabaseMock.mockProfileUpdate();
      supabaseMock.mockUserUpdate();

      const response = await request(app)
        .post('/api/profiles/complete')
        .set('Authorization', `Bearer ${authHelpers.generateValidToken()}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Profile completed successfully');
      expect(response.body).toHaveProperty('profileCompletionStage', 'completed');
      expect(response.body).toHaveProperty('registrationStep', 'profile_complete');
      expect(response.body).toHaveProperty('nextStage', 'dashboard');
    });

    test('should reject completion when completion percentage is insufficient', async () => {
      const userData = authHelpers.generateValidUser();
      const mockProfile = {
        id: 'profile_123',
        user_id: userData.id,
        completion_percentage: 30, // Below 50% threshold
        is_complete: false,
      };

      supabaseMock.mockAuthenticatedUser(userData);
      supabaseMock.mockProfileFind(mockProfile);

      const response = await request(app)
        .post('/api/profiles/complete')
        .set('Authorization', `Bearer ${authHelpers.generateValidToken()}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Profile must be at least 50% complete to finish');
      expect(response.body).toHaveProperty('code', 'INSUFFICIENT_COMPLETION');
      expect(response.body).toHaveProperty('completionPercentage', 30);
    });

    test('should reject completion when profile not found', async () => {
      const userData = authHelpers.generateValidUser();

      supabaseMock.mockAuthenticatedUser(userData);
      supabaseMock.mockProfileNotFound();

      const response = await request(app)
        .post('/api/profiles/complete')
        .set('Authorization', `Bearer ${authHelpers.generateValidToken()}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Profile not found');
      expect(response.body).toHaveProperty('code', 'PROFILE_NOT_FOUND');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/profiles/complete');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });
  });

  describe('Profile Stage Updates with New Logic', () => {
    test('should update profileCompletionStage correctly for stage-1', async () => {
      const userData = authHelpers.generateValidUser();
      const stageData = {
        maritalStatus: 'single',
        education: 'bachelors',
        occupation: 'engineer',
        height: 175,
        motherTongue: 'english'
      };

      supabaseMock.mockAuthenticatedUser(userData);
      supabaseMock.mockProfileStageUpdate();

      const response = await request(app)
        .put('/api/profiles/stages/stage-1')
        .set('Authorization', `Bearer ${authHelpers.generateValidToken()}`)
        .send(stageData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profileCompletionStage', 'stage2');
      expect(response.body).toHaveProperty('nextStage', 'stage-2');
    });

    test('should update profileCompletionStage correctly for stage-4', async () => {
      const userData = authHelpers.generateValidUser();
      const stageData = {
        primaryPhotoUrl: 'https://example.com/photo.jpg',
        isPublic: true
      };

      supabaseMock.mockAuthenticatedUser(userData);
      supabaseMock.mockProfileStageUpdate();

      const response = await request(app)
        .put('/api/profiles/stages/stage-4')
        .set('Authorization', `Bearer ${authHelpers.generateValidToken()}`)
        .send(stageData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profileCompletionStage', 'stage4');
      expect(response.body).toHaveProperty('nextStage', null); // No automatic next stage
    });
  });
});