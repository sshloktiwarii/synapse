/**
 * WebRTC Mesh Network Orchestrator with Dual DataChannel Routing
 */

import { PeerConnection } from './webrtc_peer.ts';
import { telemetry } from '../telemetry.ts';

export class MeshNetwork {
  public readonly localPeerId: string;
  private peers: Map<string, PeerConnection> = new Map();

  public onDeltaReceived: ((deltaJson: string, peerId: string) => void) | null = null;
  public onPresenceReceived: ((presenceJson: string, peerId: string) => void) | null = null;
  public onPeerJoined: ((peerId: string) => void) | null = null;
  public onPeerLeft: ((peerId: string) => void) | null = null;

  constructor(localPeerId: string) {
    this.localPeerId = localPeerId;
  }

  public getPeersCount(): number {
    return this.peers.size;
  }

  public getPeer(peerId: string): PeerConnection | undefined {
    return this.peers.get(peerId);
  }

  public addPeer(peer: PeerConnection): void {
    this.peers.set(peer.peerId, peer);

    peer.onReliableMessage = (data) => {
      if (this.onDeltaReceived) {
        this.onDeltaReceived(data, peer.peerId);
      }
    };

    peer.onPresenceMessage = (data) => {
      if (this.onPresenceReceived) {
        this.onPresenceReceived(data, peer.peerId);
      }
    };

    peer.onConnectionStateChange = (state) => {
      if (state === 'connected') {
        telemetry.record('peer_connected', { peer_count: this.peers.size }, { peer_id: peer.peerId });
        if (this.onPeerJoined) this.onPeerJoined(peer.peerId);
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.removePeer(peer.peerId);
      }
    };
  }

  public removePeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.close();
      this.peers.delete(peerId);
      telemetry.record('peer_disconnected', { peer_count: this.peers.size }, { peer_id: peerId });
      if (this.onPeerLeft) this.onPeerLeft(peerId);
    }
  }

  /**
   * Broadcasts reliable payload (CRDT delta / snapshot) to all connected peers.
   */
  public broadcastReliable(message: string): void {
    for (const peer of this.peers.values()) {
      if (peer.reliableChannel && peer.reliableChannel.readyState === 'open') {
        try {
          peer.reliableChannel.send(message);
        } catch (err) {
          console.warn(`[Mesh] Failed to send reliable message to ${peer.peerId}:`, err);
        }
      }
    }
  }

  /**
   * Broadcasts ephemeral payload (120Hz cursor presence) to all connected peers.
   */
  public broadcastPresence(message: string): void {
    for (const peer of this.peers.values()) {
      if (peer.presenceChannel && peer.presenceChannel.readyState === 'open') {
        try {
          peer.presenceChannel.send(message);
        } catch (err) {
          console.warn(`[Mesh] Failed to send presence message to ${peer.peerId}:`, err);
        }
      }
    }
  }

  public disconnectAll(): void {
    for (const peer of this.peers.values()) {
      peer.close();
    }
    this.peers.clear();
  }
}
