/**
 * BroadcastChannel Signaling Adapter for Zero-Server Multi-Tab P2P Mesh
 */

import { PeerConnection } from './webrtc_peer.ts';
import { MeshNetwork } from './mesh_network.ts';

export type SignalingMessage =
  | { type: 'ANNOUNCE'; senderId: string }
  | { type: 'ANNOUNCE_ACK'; senderId: string; targetId: string }
  | { type: 'OFFER'; senderId: string; targetId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ANSWER'; senderId: string; targetId: string; sdp: RTCSessionDescriptionInit }
  | { type: 'CANDIDATE'; senderId: string; targetId: string; candidate: RTCIceCandidateInit }
  | { type: 'LEAVE'; senderId: string };

export class BroadcastSignaling {
  public readonly peerId: string;
  private channel: BroadcastChannel | null = null;
  private mesh: MeshNetwork;
  private isDestroyed: boolean = false;

  constructor(peerId: string, mesh: MeshNetwork, channelName: string = 'synapse-mesh-signaling') {
    this.peerId = peerId;
    this.mesh = mesh;

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(channelName);
      this.channel.onmessage = (event) => this.handleMessage(event.data);
    }
  }

  public start(): void {
    if (!this.channel) return;
    this.send({ type: 'ANNOUNCE', senderId: this.peerId });
  }

  public send(msg: SignalingMessage): void {
    if (this.channel && !this.isDestroyed) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.warn('[Signaling] BroadcastChannel send error:', err);
      }
    }
  }

  private async handleMessage(msg: SignalingMessage): Promise<void> {
    if (!msg || msg.senderId === this.peerId) return;

    switch (msg.type) {
      case 'ANNOUNCE': {
        // Send ACK back to new peer
        this.send({
          type: 'ANNOUNCE_ACK',
          senderId: this.peerId,
          targetId: msg.senderId,
        });

        // The peer with smaller ID initiates WebRTC connection
        if (this.peerId < msg.senderId) {
          await this.initiatePeerConnection(msg.senderId);
        }
        break;
      }

      case 'ANNOUNCE_ACK': {
        if (msg.targetId === this.peerId) {
          if (this.peerId < msg.senderId) {
            await this.initiatePeerConnection(msg.senderId);
          }
        }
        break;
      }

      case 'OFFER': {
        if (msg.targetId === this.peerId) {
          let peer = this.mesh.getPeer(msg.senderId);
          if (!peer) {
            peer = new PeerConnection(msg.senderId, false, (type, payload, target) => {
              this.forwardSignal(type, payload, target);
            });
            this.mesh.addPeer(peer);
          }

          const answer = await peer.handleOffer(msg.sdp);
          if (answer) {
            this.send({
              type: 'ANSWER',
              senderId: this.peerId,
              targetId: msg.senderId,
              sdp: answer,
            });
          }
        }
        break;
      }

      case 'ANSWER': {
        if (msg.targetId === this.peerId) {
          const peer = this.mesh.getPeer(msg.senderId);
          if (peer) {
            await peer.handleAnswer(msg.sdp);
          }
        }
        break;
      }

      case 'CANDIDATE': {
        if (msg.targetId === this.peerId) {
          const peer = this.mesh.getPeer(msg.senderId);
          if (peer) {
            await peer.handleIceCandidate(msg.candidate);
          }
        }
        break;
      }

      case 'LEAVE': {
        this.mesh.removePeer(msg.senderId);
        break;
      }
    }
  }

  private async initiatePeerConnection(targetPeerId: string): Promise<void> {
    const peer = new PeerConnection(targetPeerId, true, (type, payload, target) => {
      this.forwardSignal(type, payload, target);
    });
    this.mesh.addPeer(peer);

    const offer = await peer.createOffer();
    if (offer) {
      this.send({
        type: 'OFFER',
        senderId: this.peerId,
        targetId: targetPeerId,
        sdp: offer,
      });
    }
  }

  private forwardSignal(type: string, payload: unknown, targetPeerId: string): void {
    if (type === 'ICE_CANDIDATE') {
      this.send({
        type: 'CANDIDATE',
        senderId: this.peerId,
        targetId: targetPeerId,
        candidate: payload as RTCIceCandidateInit,
      });
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.send({ type: 'LEAVE', senderId: this.peerId });
    this.channel?.close();
    this.channel = null;
  }
}
