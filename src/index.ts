/**
 * Tab Talk - Inter-tab/window communication using BroadcastChannel API
 * 
 * A lightweight, browser-only framework for inter-tab/window communication
 * using the Broadcast Channel API. Enables each browsing context (tab, window, iframe)
 * to register a unique identity, discover other active contexts, and send messages
 * to specific identities or broadcast messages to all.
 */

export { TabCommunicator } from './TabCommunicator';
export { 
  BroadcastChannelUnsupportedError,
  InvalidMessageError,
  PeerNotFoundError,
  CommunicatorClosedError
} from './errors';
export type { 
  Message, 
  TabCommunicatorOptions, 
  EventType,
  InternalMessageType,
  PeerInfo
} from './types';