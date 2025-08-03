/**
 * Message structure for inter-tab communication
 */
export interface Message {
  /** Sender ID (internal ID or registration ID) */
  from: string;
  /** Recipient ID or null for broadcast */
  to: string | null;
  /** Message type identifier */
  type: string;
  /** Message payload data */
  payload: any;
  /** Automatically added timestamp */
  timestamp: number;
}

/**
 * Internal message types used by the framework
 */
export enum InternalMessageType {
  REGISTER = '__tc_register',
  DISCONNECT = '__tc_disconnect',
  DISCOVER = '__tc_discover',
  DISCOVER_RESPONSE = '__tc_discover_response',
  HEARTBEAT = '__tc_heartbeat',
  HEARTBEAT_RESPONSE = '__tc_heartbeat_response'
}

/**
 * Peer information
 */
export interface PeerInfo {
  /** Internal ID of the peer */
  internalId: string;
  /** Registration ID of the peer (if provided) */
  registrationId: string | null;
  /** Timestamp when peer was discovered */
  lastSeen: number;
}

/**
 * Configuration options for TabCommunicator
 */
export interface TabCommunicatorOptions {
  /** Name of the communication channel */
  channelName: string;
  /** Optional user-provided identifier for this instance */
  registrationId?: string;
  /** Callback for incoming messages */
  onMessage?: (message: Message) => void;
  /** Callback when a peer connects */
  onPeerConnected?: (peerId: string) => void;
  /** Callback when a peer disconnects */
  onPeerDisconnected?: (peerId: string) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

/**
 * Event listener callback type
 */
export type EventCallback = (data: any) => void;

/**
 * Supported event types
 */
export type EventType = 'message' | 'peerConnected' | 'peerDisconnected' | 'error';