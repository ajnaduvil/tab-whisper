# Tab Whisper

A lightweight, browser-only framework for inter-tab/window communication using the Broadcast Channel API. Enables each browsing context (tab, window, iframe) to register a unique identity, discover other active contexts, and send messages to specific identities or broadcast messages to all.

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

#### `on(eventType, callback)`

Registers an event listener.

- `eventType` (string): Event type ('message', 'peerConnected', 'peerDisconnected', 'error')
- `callback` (function): Handler function

```javascript
communicator.on('message', (message) => {
  console.log(`${message.from}: ${message.payload.text}`);
});
```

#### `off(eventType, callback)`

Removes an event listener.

```javascript
const handler = (message) => console.log(message);
communicator.on('message', handler);
communicator.off('message', handler);
```

#### `close()`

Disconnects the instance from the channel and cleans up resources.

```javascript
communicator.close();
```

## Usage Examples

### Direct Messaging

```javascript
import { TabCommunicator } from 'tab-whisper';

const communicator = new TabCommunicator({
  channelName: 'chat-app',
  registrationId: 'user-123'
});

// Send message to specific peer
communicator.send('user-456', 'chat', {
  text: 'Hello there!',
  timestamp: Date.now()
});

// Listen for chat messages
communicator.on('message', (message) => {
  if (message.type === 'chat') {
    console.log(`${message.from}: ${message.payload.text}`);
  }
});
```

### Broadcast Messaging

```javascript
const communicator = new TabCommunicator({
  channelName: 'my-app'
});

// Broadcast state update to all tabs
communicator.send(null, 'stateUpdate', {
  key: 'userPreferences',
  value: { theme: 'dark', language: 'en' }
});

// Listen for state updates
communicator.on('message', (message) => {
  if (message.type === 'stateUpdate') {
    const { key, value } = message.payload;
    localStorage.setItem(key, JSON.stringify(value));
  }
});
```

### Presence Detection

```javascript
const communicator = new TabCommunicator({
  channelName: 'collaboration-app',
  registrationId: 'editor-1'
});

const activeUsers = new Set();

communicator.on('peerConnected', (peerId) => {
  activeUsers.add(peerId);
  updateUserList();
});

communicator.on('peerDisconnected', (peerId) => {
  activeUsers.delete(peerId);
  updateUserList();
});

function updateUserList() {
  console.log('Active users:', Array.from(activeUsers));
  // Update UI with active users
}

// The peer management system ensures accurate presence detection:
// - Tabs that close are immediately removed from peer lists
// - Refreshed tabs are detected and re-registered
// - Crashed or unresponsive tabs are cleaned up within 15 seconds
```

### Error Handling

```javascript
import { 
  TabCommunicator, 
  BroadcastChannelUnsupportedError,
  PeerNotFoundError 
} from 'tab-whisper';

try {
  const communicator = new TabCommunicator({
    channelName: 'my-app',
    onError: (error) => {
      console.error('Communication error:', error);
    }
  });

  // Try to send to a peer that might not exist
  try {
    communicator.send('unknown-peer', 'test', { data: 'hello' });
  } catch (error) {
    if (error instanceof PeerNotFoundError) {
      console.log('Peer not found, sending as broadcast instead');
      communicator.send(null, 'test', { data: 'hello' });
    }
  }

} catch (error) {
  if (error instanceof BroadcastChannelUnsupportedError) {
    console.error('BroadcastChannel not supported in this browser');
    // Provide fallback or show error message
  }
}
```

### Framework Integration

#### React Hook

```javascript
import { useEffect, useState } from 'react';
import { TabCommunicator } from 'tab-whisper';

function useTabCommunicator(channelName, registrationId) {
  const [communicator, setCommunicator] = useState(null);
  const [peers, setPeers] = useState(new Set());
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const comm = new TabCommunicator({
      channelName,
      registrationId,
      onMessage: (message) => {
        setMessages(prev => [...prev, message]);
      },
      onPeerConnected: (peerId) => {
        setPeers(prev => new Set([...prev, peerId]));
      },
      onPeerDisconnected: (peerId) => {
        setPeers(prev => {
          const newPeers = new Set(prev);
          newPeers.delete(peerId);
          return newPeers;
        });
      }
    });

    setCommunicator(comm);

    return () => {
      comm.close();
    };
  }, [channelName, registrationId]);

  return { communicator, peers, messages };
}

// Usage in component
function ChatComponent() {
  const { communicator, peers, messages } = useTabCommunicator('chat', 'user-1');

  const sendMessage = (text) => {
    if (communicator) {
      communicator.send(null, 'chat', { text });
    }
  };

  return (
    <div>
      <div>Active peers: {peers.size}</div>
      <div>Messages: {messages.length}</div>
    </div>
  );
}
```

## Message Structure

All messages automatically include:

```typescript
interface Message {
  from: string;        // Sender ID (internal or registration ID)
  to: string | null;   // Recipient ID or null for broadcast
  type: string;        // Message type
  payload: any;        // Message data
  timestamp: number;   // Automatically added timestamp
}
```

## Internal Communication

The library uses internal message types for peer management:

- `__tc_register`: Peer registration messages
- `__tc_disconnect`: Peer disconnection messages  
- `__tc_discover`: Peer discovery requests
- `__tc_discover_response`: Peer discovery responses
- `__tc_heartbeat`: Heartbeat messages for peer verification
- `__tc_heartbeat_response`: Heartbeat responses

## Error Types

- `BroadcastChannelUnsupportedError`: BroadcastChannel API not supported
- `InvalidMessageError`: Invalid message data or type
- `PeerNotFoundError`: Target peer not found
- `CommunicatorClosedError`: Attempting to use closed communicator

## TypeScript Support

The package includes full TypeScript definitions:

```typescript
import { 
  TabCommunicator, 
  TabCommunicatorOptions, 
  Message, 
  EventType 
} from 'tab-whisper';

const options: TabCommunicatorOptions = {
  channelName: 'typed-app',
  registrationId: 'user-1',
  onMessage: (message: Message) => {
    console.log(message.type, message.payload);
  }
};

const communicator = new TabCommunicator(options);
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure all changes maintain backward compatibility and follow the established patterns.