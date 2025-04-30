import { Context } from "telegraf";

export interface Order {
  id: string;
  date: string;
  status: string;
  bouquet: string;
}

export interface UserOrders {
  [userId: number]: Order[];
}

export interface CustomSession {
  lastMessageId?: number;
}

export interface CustomContext extends Context {
  session: CustomSession;
}
