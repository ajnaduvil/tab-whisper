import {
  Message,
  InternalMessageType,
  PeerInfo,
  TabCommunicatorOptions,
  EventCallback,
  EventType
} from './types.js';
import {
  BroadcastChannelUnsupportedError,
  InvalidMessageError,
  PeerNotFoundError,
  CommunicatorClosedError
} from './errors.js';

/**
 * TabCommunicator - A lightweight framework for inter-tab communication
 * 
 * This class provides a simple and reliable way to communicate between different
 * browser tabs, windows, and iframes using the BroadcastChannel API. It handles
 * peer discovery, message routing, and automatic cleanup of disconnected peers.
 * 
 * @example
 * ```javascript
 * const communicator = new TabCommunicator({
 *   channelName: 'my-app',
 *   registrationId: 'user-dashboard',
 *   onMessage: (message) => {
 *     console.log('Received:', message);
 *   },
 *   onPeerConnected: (peerId) => {
 *     console.log('Peer connected:', peerId);
 *   },
 *   onPeerDisconnected: (peerId) => {
 *     console.log('Peer disconnected:', peerId);
 *   }
 * });
 * 
 * // Send message to specific peer
 * communicator.send('peer-id', 'chat', { text: 'Hello!' });
 * 
 * // Broadcast to all peers
 * communicator.send(null, 'update', { data: { count: 42 } });
 * ```
 */
export class TabCommunicator {
  private readonly _id: string;
  private readonly _registrationId: string | null;
  private readonly _channelName: string;
  private readonly _channel: BroadcastChannel;
  private readonly _peers: Map<string, PeerInfo> = new Map();
  private readonly _eventListeners: Map<string, Set<EventCallback>> = new Map();
  private _isConnected: boolean = false;
  private _discoveryTimeout: number | null = null;
  private _peerVerificationInterval: number | null = null;
  private _heartbeatInterval: number | null = null;

  // Callback options
  private readonly _onMessage?: (message: Message) => void;
  private readonly _onPeerConnected?: (peerId: string) => void;
  private readonly _onPeerDisconnected?: (peerId: string) => void;
  private readonly _onError?: (error: Error) => void;

  /**
   * Creates a new TabCommunicator instance
   * 
   * @param options - Configuration options for the communicator
   * @throws {BroadcastChannelUnsupportedError} When BroadcastChannel API is not supported
   * 
   * @example
   * ```javascript
   * const communicator = new TabCommunicator({
   *   channelName: 'chat-app',
   *   registrationId: 'user-123',
   *   onMessage: (message) => {
   *     console.log('Message from', message.from, ':', message.payload);
   *   }
   * });
   * ```
   */
  constructor(options: TabCommunicatorOptions) {
    // Check BroadcastChannel support
    if (typeof BroadcastChannel === 'undefined') {
      throw new BroadcastChannelUnsupportedError();
    }

    this._channelName = options.channelName;
    this._registrationId = options.registrationId || null;
    this._id = this._generateInternalId();

    // Store callbacks
    this._onMessage = options.onMessage;
    this._onPeerConnected = options.onPeerConnected;
    this._onPeerDisconnected = options.onPeerDisconnected;
    this._onError = options.onError;

    // Create broadcast channel
    this._channel = new BroadcastChannel(this._channelName);
    this._channel.addEventListener('message', this._handleMessage.bind(this));

    // Initialize connection
    this._initialize();
    
    // Start heartbeat system
    this._startHeartbeat();
    
    // Set up beforeunload listener for tab close detection
    this._setupTabCloseDetection();
  }

  /**
   * Internal ID of this instance (automatically generated)
   * 
   * This is a unique identifier generated for each TabCommunicator instance.
   * It's used internally for peer management and can be used for debugging.
   * 
   * @example
   * ```javascript
   * console.log('My internal ID:', communicator.id);
   * // Output: "My internal ID: abc123-def456-ghi789"
   * ```
   */
  get id(): string {
    return this._id;
  }

  /**
   * Registration ID of this instance (user-provided)
   * 
   * This is the optional user-provided identifier. If not provided during
   * construction, this will be null. Registration IDs are preferred over
   * internal IDs for user-facing operations.
   * 
   * @example
   * ```javascript
   * const communicator = new TabCommunicator({
   *   channelName: 'my-app',
   *   registrationId: 'user-dashboard'
   * });
   * 
   * console.log('My registration ID:', communicator.registrationId);
   * // Output: "My registration ID: user-dashboard"
   * ```
   */
  get registrationId(): string | null {
    return this._registrationId;
  }

  /**
   * Set of active peer IDs (excluding self)
   * 
   * Returns a Set containing the IDs of all currently connected peers.
   * Registration IDs are preferred over internal IDs when available.
   * 
   * @example
   * ```javascript
   * console.log('Active peers:', Array.from(communicator.peers));
   * // Output: "Active peers: ['user-1', 'user-2', 'abc123-def456']"
   * ```
   */
  get peers(): Set<string> {
    const peerIds = new Set<string>();
    for (const peer of this._peers.values()) {
      // Prefer registration ID if available, otherwise use internal ID
      peerIds.add(peer.registrationId || peer.internalId);
    }
    return peerIds;
  }

  /**
   * Name of the communication channel
   * 
   * This is the channel name used for communication between peers.
   * All instances with the same channel name can communicate with each other.
   * 
   * @example
   * ```javascript
   * console.log('Channel name:', communicator.channelName);
   * // Output: "Channel name: my-app"
   * ```
   */
  get channelName(): string {
    return this._channelName;
  }

  /**
   * Connection status of the communicator
   * 
   * Returns true if the communicator is connected and ready to send/receive messages.
   * 
   * @example
   * ```javascript
   * if (communicator.isConnected) {
   *   communicator.send(null, 'ready', { status: 'online' });
   * }
   * ```
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Sends a message to a specific peer or broadcasts to all peers
   * 
   * @param targetId - Recipient ID (internal ID or registration ID), or null for broadcast
   * @param type - Message type identifier
   * @param payload - JSON-serializable data to send
   * @throws {CommunicatorClosedError} When the communicator is closed
   * @throws {PeerNotFoundError} When targetId is specified but peer not found
   * @throws {InvalidMessageError} When message data is invalid
   * 
   * @example
   * ```javascript
   * // Send to specific peer using registration ID
   * communicator.send('user-123', 'chat', { text: 'Hello!' });
   * 
   * // Send to specific peer using internal ID
   * communicator.send('abc123-def456', 'notification', { title: 'Update' });
   * 
   * // Broadcast to all peers
   * communicator.send(null, 'update', { data: { count: 42 } });
   * 
   * // Send with complex payload
   * communicator.send('user-456', 'state-change', {
   *   action: 'UPDATE_USER',
   *   data: { name: 'John', age: 30 },
   *   timestamp: Date.now()
   * });
   * ```
   */
  send(targetId: string | null, type: string, payload: any): void {
    this._ensureConnected();
    this._validateMessage(type, payload);

    const message: Message = {
      from: this._registrationId || this._id,
      to: targetId,
      type,
      payload,
      timestamp: Date.now()
    };

    // If sending to specific peer, verify they exist
    if (targetId && !this._findPeerByAnyId(targetId)) {
      throw new PeerNotFoundError(`Peer '${targetId}' not found`);
    }

    this._channel.postMessage(message);
  }

  /**
   * Registers an event listener
   * 
   * @param eventType - The type of event to listen for
   * @param callback - The function to call when the event occurs
   * 
   * @example
   * ```javascript
   * // Listen for all messages
   * communicator.on('message', (message) => {
   *   console.log(`${message.from}: ${message.payload.text}`);
   * });
   * 
   * // Listen for peer connections
   * communicator.on('peerConnected', (peerId) => {
   *   console.log('New peer connected:', peerId);
   * });
   * 
   * // Listen for peer disconnections
   * communicator.on('peerDisconnected', (peerId) => {
   *   console.log('Peer disconnected:', peerId);
   * });
   * 
   * // Listen for errors
   * communicator.on('error', (error) => {
   *   console.error('Communication error:', error);
   * });
   * ```
   */
  on(eventType: EventType, callback: EventCallback): void {
    if (!this._eventListeners.has(eventType)) {
      this._eventListeners.set(eventType, new Set());
    }
    this._eventListeners.get(eventType)!.add(callback);
  }

  /**
   * Removes an event listener
   * 
   * @param eventType - The type of event to stop listening for
   * @param callback - The function to remove from the event listeners
   * 
   * @example
   * ```javascript
   * const messageHandler = (message) => console.log(message);
   * 
   * // Add listener
   * communicator.on('message', messageHandler);
   * 
   * // Remove listener
   * communicator.off('message', messageHandler);
   * ```
   */
  off(eventType: EventType, callback: EventCallback): void {
    const listeners = this._eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Disconnects the instance from the channel and cleans up resources
   * 
   * This method should be called when you're done with the communicator
   * to prevent memory leaks and ensure proper cleanup.
   * 
   * @example
   * ```javascript
   * // Clean up when component unmounts (React example)
   * useEffect(() => {
   *   const communicator = new TabCommunicator({
   *     channelName: 'my-app'
   *   });
   * 
   *   return () => {
   *     communicator.close();
   *   };
   * }, []);
   * ```
   */
  close(): void {
    if (!this._isConnected) {
      return;
    }

    // Send disconnect message
    this._sendInternalMessage(InternalMessageType.DISCONNECT, {
      internalId: this._id,
      registrationId: this._registrationId
    });

    // Clear intervals
    if (this._discoveryTimeout) {
      clearTimeout(this._discoveryTimeout);
    }
    if (this._peerVerificationInterval) {
      clearInterval(this._peerVerificationInterval);
    }
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
    }

    // Close channel
    this._channel.close();
    this._isConnected = false;
  }

  /**
   * Initialize the communicator
   */
  private _initialize(): void {
    this._isConnected = true;

    // Send registration message
    this._sendInternalMessage(InternalMessageType.REGISTER, {
      internalId: this._id,
      registrationId: this._registrationId
    });

    // Discover existing peers
    this._sendInternalMessage(InternalMessageType.DISCOVER, {
      internalId: this._id,
      registrationId: this._registrationId
    });
  }

  /**
   * Generate a unique internal ID
   */
  private _generateInternalId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `tc_${timestamp}_${random}`;
  }

  /**
   * Handle incoming messages
   */
  private _handleMessage(event: MessageEvent): void {
    try {
      const message = event.data as Message;

      // Ignore messages from self
      if (message.from === this._id || message.from === this._registrationId) {
        return;
      }

      // Handle internal messages
      if (Object.values(InternalMessageType).includes(message.type as InternalMessageType)) {
        this._handleInternalMessage(message);
        return;
      }

      // Handle targeted messages
      if (message.to !== null) {
        const isForMe = message.to === this._id || message.to === this._registrationId;
        if (!isForMe) {
          return; // Message not for us
        }
      }

      // Emit message event
      this._emitEvent('message', message);
      
      // Call onMessage callback
      if (this._onMessage) {
        this._onMessage(message);
      }
    } catch (error) {
      this._handleError(error as Error);
    }
  }

  /**
   * Handle internal framework messages
   */
  private _handleInternalMessage(message: Message): void {
    const { type, payload } = message;

    switch (type) {
      case InternalMessageType.REGISTER:
        this._handlePeerRegister(payload);
        break;

      case InternalMessageType.DISCONNECT:
        this._handlePeerDisconnect(payload);
        break;

      case InternalMessageType.DISCOVER:
        this._handlePeerDiscover(message.from);
        break;

      case InternalMessageType.DISCOVER_RESPONSE:
        this._handlePeerRegister(payload);
        break;

      case InternalMessageType.HEARTBEAT:
        this._handlePeerHeartbeat(message.from);
        break;

      case InternalMessageType.HEARTBEAT_RESPONSE:
        this._handlePeerHeartbeatResponse(payload);
        break;
    }
  }

  /**
   * Handle peer registration
   */
  private _handlePeerRegister(payload: any): void {
    const { internalId, registrationId } = payload;
    
    if (internalId === this._id) {
      return; // Ignore self
    }

    const existingPeer = this._peers.get(internalId);
    if (!existingPeer) {
      // New peer
      const peerInfo: PeerInfo = {
        internalId,
        registrationId: registrationId || null,
        lastSeen: Date.now()
      };
      
      this._peers.set(internalId, peerInfo);
      
      const peerId = registrationId || internalId;
      this._emitEvent('peerConnected', peerId);
      
      if (this._onPeerConnected) {
        this._onPeerConnected(peerId);
      }
    } else {
      // Update existing peer
      existingPeer.lastSeen = Date.now();
      existingPeer.registrationId = registrationId || null;
    }
  }

  /**
   * Handle peer disconnection
   */
  private _handlePeerDisconnect(payload: any): void {
    const { internalId } = payload;
    const peer = this._peers.get(internalId);
    
    if (peer) {
      this._peers.delete(internalId);
      
      const peerId = peer.registrationId || peer.internalId;
      this._emitEvent('peerDisconnected', peerId);
      
      if (this._onPeerDisconnected) {
        this._onPeerDisconnected(peerId);
      }
    }
  }

  /**
   * Handle peer discovery request
   */
  private _handlePeerDiscover(fromId: string): void {
    // Respond with our registration info
    this._sendInternalMessage(InternalMessageType.DISCOVER_RESPONSE, {
      internalId: this._id,
      registrationId: this._registrationId
    });
  }

  /**
   * Handle peer heartbeat request
   */
  private _handlePeerHeartbeat(fromId: string): void {
    // Respond to heartbeat request
    this._sendInternalMessage(InternalMessageType.HEARTBEAT_RESPONSE, {
      internalId: this._id,
      registrationId: this._registrationId
    });
  }

  /**
   * Handle peer heartbeat response
   */
  private _handlePeerHeartbeatResponse(payload: any): void {
    const { internalId } = payload;
    const peer = this._peers.get(internalId);
    
    if (peer) {
      // Update last seen timestamp
      peer.lastSeen = Date.now();
    }
  }

  /**
   * Set up tab close detection
   */
  private _setupTabCloseDetection(): void {
    const handleBeforeUnload = () => {
      // Send disconnect message before tab closes
      this._sendInternalMessage(InternalMessageType.DISCONNECT, {
        internalId: this._id,
        registrationId: this._registrationId
      });
    };

    // Listen for tab close/refresh
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Also listen for page visibility changes (when tab becomes hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Tab is hidden, but not necessarily closed
        // We'll rely on heartbeat for this case
      }
    });
  }

  /**
   * Start heartbeat system
   */
  private _startHeartbeat(): void {
    // Send heartbeat every 5 seconds
    this._heartbeatInterval = setInterval(() => {
      this._sendHeartbeat();
    }, 5000);
  }

  /**
   * Send heartbeat to all peers
   */
  private _sendHeartbeat(): void {
    if (!this._isConnected) return;

    this._sendInternalMessage(InternalMessageType.HEARTBEAT, {
      internalId: this._id,
      registrationId: this._registrationId
    });

    // Clean up stale peers (haven't been seen for 15 seconds)
    const now = Date.now();
    const stalePeers: string[] = [];

    for (const [internalId, peer] of this._peers.entries()) {
      if (now - peer.lastSeen > 15000) {
        stalePeers.push(internalId);
      }
    }

    // Remove stale peers
    for (const internalId of stalePeers) {
      const peer = this._peers.get(internalId);
      if (peer) {
        this._peers.delete(internalId);
        const peerId = peer.registrationId || peer.internalId;
        this._emitEvent('peerDisconnected', peerId);
        
        if (this._onPeerDisconnected) {
          this._onPeerDisconnected(peerId);
        }
      }
    }
  }

  /**
   * Send an internal framework message
   */
  private _sendInternalMessage(type: InternalMessageType, payload: any): void {
    const message: Message = {
      from: this._id,
      to: null,
      type,
      payload,
      timestamp: Date.now()
    };

    this._channel.postMessage(message);
  }

  /**
   * Find a peer by any ID (internal or registration)
   */
  private _findPeerByAnyId(id: string): PeerInfo | undefined {
    for (const peer of this._peers.values()) {
      if (peer.internalId === id || peer.registrationId === id) {
        return peer;
      }
    }
    return undefined;
  }

  /**
   * Validate message parameters
   */
  private _validateMessage(type: string, payload: any): void {
    if (typeof type !== 'string' || type.trim() === '') {
      throw new InvalidMessageError('Message type must be a non-empty string');
    }

    // Check if payload is JSON serializable
    try {
      JSON.stringify(payload);
    } catch (error) {
      throw new InvalidMessageError('Message payload must be JSON-serializable');
    }
  }

  /**
   * Ensure the communicator is connected
   */
  private _ensureConnected(): void {
    if (!this._isConnected) {
      throw new CommunicatorClosedError();
    }
  }

  /**
   * Emit an event to listeners
   */
  private _emitEvent(eventType: string, data: any): void {
    const listeners = this._eventListeners.get(eventType);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          this._handleError(error as Error);
        }
      }
    }
  }

  /**
   * Handle errors
   */
  private _handleError(error: Error): void {
    this._emitEvent('error', error);
    
    if (this._onError) {
      this._onError(error);
    } else {
      console.error('TabCommunicator error:', error);
    }
  }
}