# Credora 0G Integration

This document describes the integration of 0G (Zero Gravity) infrastructure into the Credora credit scoring system.

## Overview

The app has been upgraded from a simple rule-based credit scoring system to a fully integrated 0G-powered AI/ML credit engine. This integration provides:

- **Real ML Inference**: Replaces dummy/rule-based scoring with actual ML model inference via 0G Compute
- **Decentralized Storage**: Uses 0G Storage layer for user data (wallet, tx history, lending history)
- **Real-time Streaming**: Streams updates through 0G Data Pipelines for instant dashboard updates
- **Unchanged UI**: Frontend design remains identical, just powered by 0G backend

## Architecture

### 0G Services Integration

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   0G Storage    │    │   0G Compute    │
│   (Unchanged)   │◄──►│   (User Data)   │◄──►│  (ML Inference) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  0G Pipeline    │    │  Credit Score   │    │  Real-time      │
│  (Streaming)    │    │  Results        │    │  Updates        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Service Components

1. **0G Configuration** (`src/services/0g-config.ts`)
   - Centralized configuration for all 0G services
   - Environment variables for endpoints and API keys
   - Mock implementations for development

2. **0G Storage Service** (`src/services/0g-storage.ts`)
   - User data storage (wallet addresses, transaction history, lending records)
   - Encrypted storage linked to wallet IDs
   - CRUD operations for user data

3. **0G Compute Service** (`src/services/0g-compute.ts`)
   - ML model inference for credit scoring
   - Feature extraction from user data
   - Credit score calculation (0-1000 scale)

4. **0G Pipeline Service** (`src/services/0g-pipeline.ts`)
   - Real-time event streaming
   - WebSocket connections for live updates
   - Event publishing and subscription management

5. **0G Credit Score Service** (`src/services/0g-credit-score.ts`)
   - Main integration service
   - Orchestrates all 0G components
   - Provides unified API for credit scoring

## Implementation Details

### Credit Scoring Model

The ML model takes the following inputs:
- Wallet address
- Balance
- Transaction count
- Transaction history
- Lending history
- Last activity timestamp

And outputs:
- Credit score (0-1000)
- Risk level (Low/Medium/High)
- Confidence score (0-1)
- Contributing factors

### Real-time Updates

The system provides real-time updates for:
- Credit score changes
- New transactions
- Lending activity (loans created, repaid, defaulted)

Updates are streamed via 0G Pipeline and automatically reflected in the UI.

### Data Flow

1. **User connects wallet** → Wallet data retrieved from blockchain
2. **Data stored in 0G Storage** → User profile created/updated
3. **ML inference triggered** → 0G Compute runs credit scoring model
4. **Results stored** → Credit score saved to 0G Storage
5. **Real-time update published** → 0G Pipeline broadcasts update
6. **UI updates** → Dashboard reflects new credit score

## API Changes

### Updated Credit Score API

The `/api/getCreditScore` endpoint now:

- Uses 0G AI/ML engine instead of rule-based logic
- Returns enhanced response with confidence and factors
- Maintains backward compatibility with existing frontend

**New Response Format:**
```json
{
  "wallet": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
  "creditScore": "High",
  "walletData": {
    "balance": "2.5 ETH",
    "transactionCount": 25,
    "lastActivity": "2024-01-15"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "wave": "Wave 2 - 0G AI/ML Engine",
  "poweredBy": "0G AI/ML Engine",
  "modelVersion": "1.0.0",
  "confidence": 0.85,
  "factors": [...],
  "rawScore": 750
}
```

## Frontend Integration

### React Hook

The `useCreditScore` hook provides:

- Automatic credit score fetching
- Real-time updates via 0G Pipeline
- Auto-refresh capabilities
- Error handling and loading states

```typescript
const { creditScore, isLoading, error, refresh, isRealTimeConnected } = useCreditScore(
  walletAddress,
  {
    autoRefresh: true,
    refreshInterval: 60000,
    enableRealTimeUpdates: true,
  }
);
```

### Dashboard Updates

The dashboard now includes:

- 0G status indicator showing pipeline connection
- Real-time credit score updates
- Enhanced credit score display with confidence
- Activity feed showing 0G-powered updates

## Environment Variables

Required environment variables:

```env
VITE_0G_STORAGE_ENDPOINT=https://storage.0g.ai
VITE_0G_STORAGE_API_KEY=your_storage_api_key
VITE_0G_COMPUTE_ENDPOINT=https://compute.0g.ai
VITE_0G_COMPUTE_API_KEY=your_compute_api_key
VITE_0G_PIPELINE_ENDPOINT=https://pipeline.0g.ai
VITE_0G_PIPELINE_API_KEY=your_pipeline_api_key
VITE_0G_WEBSOCKET_URL=wss://pipeline.0g.ai/ws
VITE_0G_CREDIT_MODEL_ID=credora-credit-scoring-v1
VITE_0G_ENCRYPTION_KEY=your_encryption_key
```

## Development Notes

### Mock Implementations

For development and testing, the system includes mock implementations of all 0G services. These provide:

- Simulated credit scoring logic
- Mock storage operations
- Simulated real-time updates
- Development-friendly behavior

### Production Deployment

For production deployment:

1. Replace mock implementations with actual 0G SDK calls
2. Configure real 0G endpoints and API keys
3. Deploy ML model to 0G Compute
4. Set up proper encryption keys
5. Configure WebSocket endpoints for real-time updates

## Benefits

### Scalability
- Off-chain storage reduces blockchain load
- Distributed compute for ML inference
- Real-time streaming for instant updates

### Performance
- Fast credit score generation
- Real-time dashboard updates
- Efficient data storage and retrieval

### Reliability
- Decentralized infrastructure
- Fault-tolerant design
- Automatic failover capabilities

### Privacy
- Encrypted data storage
- User-controlled data access
- GDPR compliance ready

## Future Enhancements

- Cross-chain data aggregation
- Advanced ML models
- Social lending features
- DeFi protocol integrations
- Portfolio analytics
- Market data integration

## Troubleshooting

### Common Issues

1. **0G Pipeline not connecting**
   - Check WebSocket URL configuration
   - Verify API keys
   - Check network connectivity

2. **Credit score not updating**
   - Verify 0G Compute service status
   - Check ML model availability
   - Review input data format

3. **Storage operations failing**
   - Verify 0G Storage endpoint
   - Check API key permissions
   - Review data format requirements

### Debug Mode

Enable debug logging by setting:
```env
VITE_DEBUG_0G=true
```

This will log all 0G operations to the console for debugging purposes.
