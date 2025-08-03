/**
 * Error thrown when BroadcastChannel API is not supported
 */
export class BroadcastChannelUnsupportedError extends Error {
  constructor() {
    super('BroadcastChannel API is not supported in this environment');
    this.name = 'BroadcastChannelUnsupportedError';
  }
}

/**
 * Error thrown when a message is invalid
 */
export class InvalidMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMessageError';
  }
}

/**
 * Error thrown when a target peer is not found
 */
export class PeerNotFoundError extends Error {
  constructor(peerId: string) {
    super(`Peer with ID "${peerId}" not found`);
    this.name = 'PeerNotFoundError';
  }
}

/**
 * Error thrown when trying to use a closed communicator
 */
export class CommunicatorClosedError extends Error {
  constructor() {
    super('TabCommunicator instance has been closed');
    this.name = 'CommunicatorClosedError';
  }
}