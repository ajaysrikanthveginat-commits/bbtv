export type UserRole = 'host' | 'participant';

export type SignalingMessageType =
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'RECONNECT_ROOM'
  | 'LEAVE_ROOM'
  | 'ROOM_JOINED'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'OFFER'
  | 'ANSWER'
  | 'ICE_CANDIDATE'
  | 'ROOM_ERROR'
  | 'CHAT_MESSAGE'
  | 'SCREEN_SHARE_STARTED'
  | 'SCREEN_SHARE_STOPPED';

export interface BaseSignalingMessage {
  type: SignalingMessageType;
  roomId: string;
  senderId: string;
  targetId?: string;
}

export interface CreateRoomMessage extends BaseSignalingMessage {
  type: 'CREATE_ROOM';
}

export interface JoinRoomMessage extends BaseSignalingMessage {
  type: 'JOIN_ROOM';
}

export interface ReconnectRoomMessage extends BaseSignalingMessage {
  type: 'RECONNECT_ROOM';
  role?: UserRole;
}

export interface LeaveRoomMessage extends BaseSignalingMessage {
  type: 'LEAVE_ROOM';
  userId: string;
}

export interface RoomJoinedMessage extends BaseSignalingMessage {
  type: 'ROOM_JOINED';
  role: UserRole;
  remoteUserId?: string | null;
}

export interface UserJoinedMessage extends BaseSignalingMessage {
  type: 'USER_JOINED';
  userId: string;
  role: UserRole;
}

export interface UserLeftMessage extends BaseSignalingMessage {
  type: 'USER_LEFT';
  userId: string;
}

export interface OfferMessage extends BaseSignalingMessage {
  type: 'OFFER';
  targetId: string;
  payload: RTCSessionDescriptionInit;
}

export interface AnswerMessage extends BaseSignalingMessage {
  type: 'ANSWER';
  targetId: string;
  payload: RTCSessionDescriptionInit;
}

export interface IceCandidateMessage extends BaseSignalingMessage {
  type: 'ICE_CANDIDATE';
  targetId: string;
  payload: RTCIceCandidateInit;
}

export interface RoomErrorMessage extends BaseSignalingMessage {
  type: 'ROOM_ERROR';
  message: string;
}

export interface ChatMessageSignaling extends BaseSignalingMessage {
  type: 'CHAT_MESSAGE';
  message: string;
  senderName?: string;
  id?: string;
  time?: string;
  timestamp?: number;
}

export interface ScreenShareStartedMessage extends BaseSignalingMessage {
  type: 'SCREEN_SHARE_STARTED';
  ownerRole?: UserRole;
  ownerName?: string;
  screenStreamId?: string;
  screenTrackId?: string;
}

export interface ScreenShareStoppedMessage extends BaseSignalingMessage {
  type: 'SCREEN_SHARE_STOPPED';
  ownerRole?: UserRole;
}

export type SignalingMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | ReconnectRoomMessage
  | LeaveRoomMessage
  | RoomJoinedMessage
  | UserJoinedMessage
  | UserLeftMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | RoomErrorMessage
  | ChatMessageSignaling
  | ScreenShareStartedMessage
  | ScreenShareStoppedMessage;
