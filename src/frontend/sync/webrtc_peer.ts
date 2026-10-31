/**
 * WebRTC Peer Connection Manager with STUN Fallback
 */

export interface PeerConfig {
  peerId: string;
  iceServers?: RTCIceServer[];
}

export type SignalHandler = (type: string, payload: unknown, targetPeerId: string) => void;

export class PeerConnection {
  public readonly peerId: string;
  public connection: RTCPeerConnection | null = null;
  public reliableChannel: RTCDataChannel | null = null;
  public presenceChannel: RTCDataChannel | null = null;

  public onReliableMessage: ((data: string) => void) | null = null;
  public onPresenceMessage: ((data: string) => void) | null = null;
  public onConnectionStateChange: ((state: RTCPeerConnectionState) => void) | null = null;

  private isInitiator: boolean = false;
  private signalSender: SignalHandler;

  public static readonly DEFAULT_ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  constructor(peerId: string, isInitiator: boolean, signalSender: SignalHandler, iceServers?: RTCIceServer[]) {
    this.peerId = peerId;
    this.isInitiator = isInitiator;
    this.signalSender = signalSender;

    if (typeof RTCPeerConnection !== 'undefined') {
      this.connection = new RTCPeerConnection({
        iceServers: iceServers ?? PeerConnection.DEFAULT_ICE_SERVERS,
        iceCandidatePoolSize: 4,
      });
      this.setupConnectionHandlers();
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.connection) return;

    this.connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalSender('ICE_CANDIDATE', event.candidate.toJSON(), this.peerId);
      }
    };

    this.connection.onconnectionstatechange = () => {
      if (this.connection && this.onConnectionStateChange) {
        this.onConnectionStateChange(this.connection.connectionState);
      }
    };

    this.connection.ondatachannel = (event) => {
      const channel = event.channel;
      if (channel.label === 'synapse-crdt-reliable') {
        this.reliableChannel = channel;
        this.setupReliableChannel(channel);
      } else if (channel.label === 'synapse-presence-unreliable') {
        this.presenceChannel = channel;
        this.setupPresenceChannel(channel);
      }
    };

    if (this.isInitiator) {
      this.createDataChannels();
    }
  }

  public createDataChannels(): void {
    if (!this.connection) return;

    // Reliable ordered channel for CRDT state updates
    const rel = this.connection.createDataChannel('synapse-crdt-reliable', {
      ordered: true,
    });
    this.reliableChannel = rel;
    this.setupReliableChannel(rel);

    // Unreliable unordered channel for 120Hz presence updates
    const pres = this.connection.createDataChannel('synapse-presence-unreliable', {
      ordered: false,
      maxRetransmits: 0,
    });
    this.presenceChannel = pres;
    this.setupPresenceChannel(pres);
  }

  private setupReliableChannel(channel: RTCDataChannel): void {
    channel.onmessage = (event) => {
      if (this.onReliableMessage && typeof event.data === 'string') {
        this.onReliableMessage(event.data);
      }
    };
  }

  private setupPresenceChannel(channel: RTCDataChannel): void {
    channel.onmessage = (event) => {
      if (this.onPresenceMessage && typeof event.data === 'string') {
        this.onPresenceMessage(event.data);
      }
    };
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.connection) return null;
    const offer = await this.connection.createOffer();
    await this.connection.setLocalDescription(offer);
    return offer;
  }

  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.connection) return null;
    await this.connection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.connection.createAnswer();
    await this.connection.setLocalDescription(answer);
    return answer;
  }

  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.connection) return;
    await this.connection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  public async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.connection) return;
    await this.connection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  public close(): void {
    this.reliableChannel?.close();
    this.presenceChannel?.close();
    this.connection?.close();
    this.connection = null;
  }
}
