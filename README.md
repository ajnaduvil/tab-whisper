# Tab Whisper

A lightweight, browser-only framework for inter-tab/window communication using the Broadcast Channel API. Enables each browsing context (tab, window, iframe) to register a unique identity, discover other active contexts, and send messages to specific identities or broadcast messages to all.

[![npm version](https://img.shields.io/npm/v/tab-whisper)](https://www.npmjs.com/package/tab-whisper)
[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://ajnaduvil.github.io/tab-whisper/)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/ajnaduvil/tab-whisper/blob/main/LICENSE)

## Features

- **Automatic Identity Management**: Each instance generates and maintains a unique identifier
- **Dual Identity System**: Support for both internal IDs and user-provided registration IDs
- **Peer Discovery**: Dynamic discovery and tracking of other active contexts
- **Flexible Messaging**: Support for both broadcast and direct messaging
- **Automatic Timestamps**: All messages include automatic timestamps
- **Reliable Peer Management**: Advanced tab close detection and heartbeat system
- **Framework Agnostic**: Works with any JavaScript framework or vanilla JS
- **TypeScript Support**: Full TypeScript definitions included
- **Browser-Only**: No Node.js dependencies or server-side functionality

## Installation

```bash
npm install tab-whisper
```

## Browser Compatibility

- Chrome 54+
- Firefox 38+
- Safari 15.4+
- Edge 79+

## Peer Management

The library includes advanced peer management features to ensure reliable communication:

### Tab Close Detection
- **Immediate Detection**: Uses `beforeunload` event to detect tab close/refresh instantly
- **Automatic Cleanup**: Sends disconnect messages before tabs close
- **Instant Peer Removal**: Other tabs immediately remove closing peers

### Heartbeat System
- **5-Second Intervals**: Sends heartbeat messages every 5 seconds
- **15-Second Timeout**: Removes peers that haven't responded for 15 seconds
- **Backup Mechanism**: Handles cases where `beforeunload` doesn't fire (crashes, network issues)

### Multiple Detection Methods
- **`beforeunload` Event**: Primary method for immediate tab close detection
- **`visibilitychange` Event**: Detects when tabs become hidden
- **Heartbeat System**: Backup for reliable peer cleanup

## Basic Usage

### ES Modules

```javascript
import { TabCommunicator } from 'tab-whisper';

const communicator = new TabCommunicator({
  channelName: 'my-app',
  registrationId: 'user-dashboard', // Optional user-provided ID
  onMessage: (message) => {
    console.log('Received:', message);
  },
  onPeerConnected: (peerId) => {
    console.log('Peer connected:', peerId);
  },
  onPeerDisconnected: (peerId) => {
    console.log('Peer disconnected:', peerId);
  }
});

console.log('My internal ID:', communicator.id);
console.log('My registration ID:', communicator.registrationId);
console.log('Active peers:', communicator.peers);
```

### CommonJS

```javascript
const { TabCommunicator } = require('tab-whisper');

const communicator = new TabCommunicator({
  channelName: 'my-app'
});
```

## API Reference

### Constructor

```typescript
new TabCommunicator(options: TabCommunicatorOptions)
```

**Options:**
- `channelName` (string, required): Identifier for the communication channel
- `registrationId` (string, optional): User-provided identifier for this instance
- `onMessage` (function, optional): Callback for handling incoming messages
- `onPeerConnected` (function, optional): Callback when a new peer connects
- `onPeerDisconnected` (function, optional): Callback when a peer disconnects
- `onError` (function, optional): Callback for error handling

### Properties

- `id` (read-only string): Internal ID of current instance (automatically generated)
- `registrationId` (read-only string | null): User-provided registration ID
- `peers` (read-only Set<string>): Set of active peer IDs (excluding self)
- `channelName` (read-only string): Name of the communication channel
- `isConnected` (read-only boolean): Connection status

### Methods

#### `send(targetId, type, payload)`

Sends a message to a specific peer or broadcasts to all peers.

- `targetId` (string | null): Recipient ID (internal ID or registration ID), or null for broadcast
- `type` (string): Message type identifier
- `payload` (any): JSON-serializable data

```javascript
// Send to specific peer
communicator.send('peer-id', 'chat', {
  text: 'Hello!',
  sender: 'User A'
});

// Broadcast to all peers
communicator.send(null, 'update', {
  data: { count: 42 }
});
```