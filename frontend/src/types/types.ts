// interface DrawData {
//   x: number;
//   y: number;
//   lastX: number | null;
//   lastY: number | null;
//   roomId: string;
//   color: string;
//   stroke: number;
// }

// interface ChatMessage {
//   message: string;
//   roomId: string;
//   username: string;
// }

// interface Player {
//   id: string;
//   username: string;
//   score: number;
//   isReady: boolean;
// }

// interface GameState {
//   state: "waiting" | "playing" | "ended";
//   round: number;
//   totalRounds: number;
//   players: Player[];
//   scores: Record<string, number>;
//   currentDrawer: string | null;
//   timeLeft: number;
// }

// // export all types
// export type { DrawData, ChatMessage, Player, GameState };


export interface Player {
  userId: string;
  socketId: string; // Add this property
  username: string;
  score: number;
  isReady: boolean;
  isConnected: boolean;
}

// You can keep other types here as well
export interface DrawData {
  x: number;
  y: number;
  lastX: number | null;
  lastY: number | null;
  roomId: string;
  color: string;
  stroke: number;
}

export interface ChatMessage {
  message: string;
  roomId: string;
  username: string;
}

export interface GameState {
  state: "waiting" | "playing" | "ended";
  round: number;
  totalRounds: number;
  players: Player[];
  scores: Record<string, number>;
  currentDrawer: string | null;
  timeLeft: number;
}